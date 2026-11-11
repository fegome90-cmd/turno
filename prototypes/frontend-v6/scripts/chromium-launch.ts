// Default to Playwright's platform-specific installation. Custom runners may opt in.
export function chromiumLaunchOptions() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  return executablePath ? {executablePath} : {};
}
