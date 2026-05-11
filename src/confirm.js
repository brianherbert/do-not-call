export function showResult(result) {
  console.log('');
  if (result.success) {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  ✅  COMPLAINT FILED SUCCESSFULLY        ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log('Submitted at: ' + new Date(result.timestamp).toLocaleString());
    console.log('Confirmation: ' + result.confirmationText);
    console.log('Screenshot:   ' + result.screenshotPath);
  } else {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  ❌  SUBMISSION FAILED                   ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log('Reason:      ' + result.error);
    console.log('Screenshot:  ' + result.screenshotPath);
    console.log('');
    console.log('→ You can file manually at: https://donotcall.gov');
  }
  console.log('');
}
