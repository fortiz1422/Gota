import config from './playwright.config'
const server = Array.isArray(config.webServer)
  ? config.webServer[0]
  : config.webServer
const localReviewConfig = {
  ...config,
  timeout: 45000,
  expect: { ...config.expect, timeout: 15000 },
  webServer: {
    ...server,
    command:
      'node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3100',
    env: {
      ...server?.env,
      NEXT_FONT_GOOGLE_MOCKED_RESPONSES:
        process.cwd() + '/e2e/forms/fonts/mocked-responses.cjs',
    },
  },
}

export default localReviewConfig
