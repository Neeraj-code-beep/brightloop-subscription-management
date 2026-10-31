import { verifyLiveHuggingFace } from '../utils/liveDiagnostics.js';
import { config } from '../config/index.js';

async function main() {
  console.log('='.repeat(70));
  console.log('  SUBPILOT AI — LIVE HUGGING FACE DIAGNOSTIC');
  console.log('='.repeat(70));
  console.log(`Configured Model    : ${config.huggingFaceModel}`);
  console.log(`Base URL            : ${config.huggingFaceBaseUrl}`);
  console.log(`Token Configured    : ${config.huggingFaceApiKey && !config.huggingFaceApiKey.includes('your-huggingface-api-key') ? 'YES' : 'NO'}`);
  console.log('-'.repeat(70));

  const result = await verifyLiveHuggingFace(15000);

  console.log(`Provider            : ${result.provider}`);
  console.log(`Status              : ${result.status}`);
  if (result.latencyMs !== undefined) {
    console.log(`Latency             : ${result.latencyMs}ms`);
  }
  if (result.errorCategory) {
    console.log(`Error Category      : ${result.errorCategory}`);
  }
  console.log(`Message             : ${result.message}`);
  console.log('='.repeat(70));

  if (result.status === 'FAILED') {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal diagnostic execution error:', err.message);
  process.exit(1);
});
