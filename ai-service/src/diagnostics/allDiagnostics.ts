import { verifyAllLiveProviders } from '../utils/liveDiagnostics.js';
import { config } from '../config/index.js';

async function main() {
  console.log('='.repeat(80));
  console.log('      SUBPILOT AI — LIVE PROVIDERS & EMBEDDINGS DIAGNOSTIC SUITE');
  console.log('='.repeat(80));
  console.log(`Node Environment    : ${config.nodeEnv}`);
  console.log(`Port                : ${config.port}`);
  console.log(`Backend API URL     : ${config.backendApiUrl}`);
  console.log(`Gemini Model        : ${config.geminiModel}`);
  console.log(`Embedding Model     : ${config.geminiEmbeddingModel}`);
  console.log(`Hugging Face Model  : ${config.huggingFaceModel}`);
  console.log('-'.repeat(80));

  const results = await verifyAllLiveProviders();

  console.log('\nDIAGNOSTIC REPORT:');
  console.log('-'.repeat(80));
  for (const [key, res] of Object.entries(results)) {
    const icon = res.status === 'SUCCESS' ? '✓' : res.status === 'SKIPPED_NOT_CONFIGURED' ? '○' : '✗';
    console.log(`[${icon}] ${res.provider.toUpperCase().padEnd(18)} : ${res.status.padEnd(22)} (${res.model})`);
    if (res.latencyMs !== undefined) {
      console.log(`    Latency          : ${res.latencyMs}ms`);
    }
    if (res.dimensions !== undefined) {
      console.log(`    Dimensions       : ${res.dimensions}`);
    }
    if (res.functionCallingSupported !== undefined) {
      console.log(`    Function Calling : ${res.functionCallingSupported ? 'VERIFIED' : 'PENDING'}`);
    }
    if (res.errorCategory) {
      console.log(`    Error Category   : ${res.errorCategory}`);
    }
    console.log(`    Message          : ${res.message}`);
    console.log('');
  }
  console.log('='.repeat(80));

  const hasFailure = Object.values(results).some((r) => r.status === 'FAILED');
  if (hasFailure) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal diagnostic execution error:', err.message);
  process.exit(1);
});
