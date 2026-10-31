import { config } from '../../config/index.js';
import { errorResponse } from '../../utils/response.js';

/**
 * Forward an incoming HTTP request to the upstream AI microservice.
 * Preserves method, path, query parameters, request body, headers, and status code.
 * Sanitizes errors so internal network topology and secrets are never leaked.
 *
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {string} targetPath - Relative path on the upstream AI service (e.g. '/api/v1/ai/chat')
 */
export async function forwardToAiService(req, res, targetPath) {
  const upstreamBase = (config.aiService?.url || 'http://localhost:5001').replace(/\/+$/, '');
  const cleanPath = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  const targetUrl = new URL(`${upstreamBase}${cleanPath}`);

  // Forward query parameters
  if (req.query && Object.keys(req.query).length > 0) {
    for (const [key, value] of Object.entries(req.query)) {
      if (value !== undefined && value !== null) {
        targetUrl.searchParams.append(key, String(value));
      }
    }
  }

  // Forward headers (preserve original Authorization, Content-Type, Accept)
  const headers = {};
  if (req.headers.authorization) {
    headers['authorization'] = req.headers.authorization;
  }
  if (req.headers['content-type']) {
    headers['content-type'] = req.headers['content-type'];
  }
  headers['accept'] = req.headers['accept'] || 'application/json';

  const timeoutMs = config.aiService?.timeoutMs || 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions = {
    method: req.method,
    headers,
    signal: controller.signal
  };

  if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
    if (req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json';
      }
    } else if (req.rawBody && req.rawBody.length > 0) {
      fetchOptions.body = req.rawBody;
    }
  }

  try {
    const upstreamResponse = await fetch(targetUrl.toString(), fetchOptions);
    clearTimeout(timeoutId);

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const status = upstreamResponse.status;

    if (contentType.includes('application/json')) {
      const data = await upstreamResponse.json();
      return res.status(status).json(data);
    } else {
      const text = await upstreamResponse.text();
      if (contentType) {
        res.setHeader('content-type', contentType);
      }
      return res.status(status).send(text);
    }
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout')) {
      return errorResponse(res, {
        message: 'AI service request timed out',
        statusCode: 504
      });
    }

    // Network error / connection refused / DNS resolution failure
    return errorResponse(res, {
      message: 'AI service is temporarily unavailable. Please try again later.',
      statusCode: 503
    });
  }
}
