import React, { useMemo, useState } from 'react'
import { clearOAuthTokenCache, saveApiKey } from '../utils/auth.js'
import { saveGlobalConfig } from '../utils/config.js'
import { errorMessage } from '../utils/errors.js'
import { applyConfigEnvironmentVariables } from '../utils/managedEnv.js'
import { getSecureStorage } from '../utils/secureStorage/index.js'
import { Box, Link, Text } from '../ink.js'
import { ConsoleOAuthFlow } from './ConsoleOAuthFlow.js'
import { Select } from './CustomSelect/select.js'
import TextInput from './TextInput.js'

type Props = {
  onDone(): void
}

type Screen = 'select' | 'claudeai' | 'console' | 'platform' | 'endpoint'
type EndpointPhase = 'endpoint' | 'apiKey' | 'model' | 'confirm'

const CONFLICTING_PROVIDER_ENV_KEYS = [
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'BEDROCK_BASE_URL',
  'ANTHROPIC_VERTEX_BASE_URL',
  'VERTEX_BASE_URL',
  'ANTHROPIC_VERTEX_PROJECT_ID',
  'ANTHROPIC_FOUNDRY_BASE_URL',
  'ANTHROPIC_FOUNDRY_RESOURCE',
  'ANTHROPIC_AUTH_TOKEN',
] as const

export function OnboardingAuthFlow({ onDone }: Props): React.ReactNode {
  const [screen, setScreen] = useState<Screen>('select')

  if (screen === 'claudeai') {
    return (
      <ConsoleOAuthFlow
        onDone={onDone}
        forceLoginMethod="claudeai"
        startingMessage="Choose how you want to connect Semiclaw Code."
      />
    )
  }

  if (screen === 'console') {
    return (
      <ConsoleOAuthFlow
        onDone={onDone}
        forceLoginMethod="console"
        startingMessage="Choose how you want to connect Semiclaw Code."
      />
    )
  }

  if (screen === 'platform') {
    return (
      <PlatformSetupInfo
        onBack={() => setScreen('select')}
        onUseEndpoint={() => setScreen('endpoint')}
      />
    )
  }

  if (screen === 'endpoint') {
    return (
      <ThirdPartyEndpointSetup
        onBack={() => setScreen('select')}
        onDone={onDone}
      />
    )
  }

  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Text bold>Choose how you want to connect Semiclaw Code</Text>
      <Text dimColor>
        You can use a Claude subscription, Anthropic Console billing, or a
        third-party endpoint with your own API key.
      </Text>
      <Box width={72}>
        <Select
          options={[
            {
              label: (
                <Text>
                  Claude account with subscription ·{' '}
                  <Text dimColor>Pro, Max, Team, or Enterprise</Text>
                </Text>
              ),
              value: 'claudeai',
            },
            {
              label: (
                <Text>
                  Anthropic Console account ·{' '}
                  <Text dimColor>API usage billing</Text>
                </Text>
              ),
              value: 'console',
            },
            {
              label: (
                <Text>
                  3rd-party endpoint ·{' '}
                  <Text dimColor>OpenAI-compatible proxy or custom gateway</Text>
                </Text>
              ),
              value: 'endpoint',
            },
            {
              label: (
                <Text>
                  3rd-party platform ·{' '}
                  <Text dimColor>
                    Amazon Bedrock, Microsoft Foundry, or Vertex AI
                  </Text>
                </Text>
              ),
              value: 'platform',
            },
          ]}
          onChange={value => {
            if (
              value === 'claudeai' ||
              value === 'console' ||
              value === 'endpoint' ||
              value === 'platform'
            ) {
              setScreen(value)
            }
          }}
        />
      </Box>
    </Box>
  )
}

function PlatformSetupInfo({
  onBack,
  onUseEndpoint,
}: {
  onBack(): void
  onUseEndpoint(): void
}): React.ReactNode {
  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Text bold>Using 3rd-party platforms</Text>
      <Box flexDirection="column" gap={1} width={72}>
        <Text>
          Semiclaw Code supports Amazon Bedrock, Microsoft Foundry, and Vertex AI.
          Set the required environment variables, then restart Semiclaw Code.
        </Text>
        <Text>
          If you are using a proxy or gateway instead, you can also configure a
          custom endpoint and API key directly here.
        </Text>
        <Box flexDirection="column">
          <Text bold>Documentation:</Text>
          <Text>
            · Amazon Bedrock:{' '}
            <Link url="https://code.claude.com/docs/en/amazon-bedrock">
              https://code.claude.com/docs/en/amazon-bedrock
            </Link>
          </Text>
          <Text>
            · Microsoft Foundry:{' '}
            <Link url="https://code.claude.com/docs/en/microsoft-foundry">
              https://code.claude.com/docs/en/microsoft-foundry
            </Link>
          </Text>
          <Text>
            · Vertex AI:{' '}
            <Link url="https://code.claude.com/docs/en/google-vertex-ai">
              https://code.claude.com/docs/en/google-vertex-ai
            </Link>
          </Text>
        </Box>
        <Select
          options={[
            {
              label: 'Set up custom endpoint + API key',
              value: 'endpoint',
            },
            {
              label: 'Back',
              value: 'back',
            },
          ]}
          onChange={value => {
            if (value === 'endpoint') {
              onUseEndpoint()
            } else {
              onBack()
            }
          }}
          onCancel={onBack}
        />
      </Box>
    </Box>
  )
}

function ThirdPartyEndpointSetup({
  onBack,
  onDone,
}: {
  onBack(): void
  onDone(): void
}): React.ReactNode {
  const [phase, setPhase] = useState<EndpointPhase>('endpoint')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [baseUrlCursorOffset, setBaseUrlCursorOffset] = useState(0)
  const [apiKeyCursorOffset, setApiKeyCursorOffset] = useState(0)
  const [modelNameCursorOffset, setModelNameCursorOffset] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const maskedApiKey = useMemo(() => {
    if (!apiKey) return ''
    if (apiKey.length <= 8) return '*'.repeat(apiKey.length)
    return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
  }, [apiKey])

  async function handleSave() {
    setIsSaving(true)
    setSaveError(null)

    try {
      const normalizedBaseUrl = normalizeEndpoint(baseUrl)
      const normalizedModelName = normalizeModelName(modelName)

      await saveApiKey(apiKey.trim())
      clearStoredOAuthTokens()

      saveGlobalConfig(current => {
        const env = { ...current.env }

        env.ANTHROPIC_BASE_URL = normalizedBaseUrl
        env.ANTHROPIC_MODEL = normalizedModelName
        env.ANTHROPIC_CUSTOM_MODEL_OPTION = normalizedModelName
        for (const key of CONFLICTING_PROVIDER_ENV_KEYS) {
          delete env[key]
        }

        return {
          ...current,
          env,
          oauthAccount: undefined,
        }
      })

      for (const key of CONFLICTING_PROVIDER_ENV_KEYS) {
        delete process.env[key]
      }
      process.env.ANTHROPIC_BASE_URL = normalizedBaseUrl
      process.env.ANTHROPIC_MODEL = normalizedModelName
      process.env.ANTHROPIC_CUSTOM_MODEL_OPTION = normalizedModelName
      applyConfigEnvironmentVariables()

      onDone()
    } catch (error) {
      setSaveError(errorMessage(error))
      setIsSaving(false)
    }
  }

  if (isSaving) {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>Saving third-party endpoint configuration…</Text>
        <Text dimColor>
          Semiclaw Code will use your custom base URL and saved API key after
          setup finishes.
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Text bold>Configure a 3rd-party endpoint</Text>
      <Text dimColor>
        Use this for OpenAI-compatible proxies, custom gateways, or other
        third-party endpoints that speak Claude-compatible requests through a
        custom base URL.
      </Text>
      <Text dimColor>
        Semiclaw Code will store the endpoint and default model in your config,
        and save the API key securely when supported on your machine.
      </Text>

      {phase === 'endpoint' ? (
        <Box flexDirection="column" gap={1}>
          <Text>Enter the base URL for your endpoint:</Text>
          <Box>
            <Text dimColor>URL &gt; </Text>
            <TextInput
              value={baseUrl}
              onChange={setBaseUrl}
              onSubmit={value => {
                try {
                  setBaseUrl(normalizeEndpoint(value))
                  setSaveError(null)
                  setPhase('apiKey')
                } catch (error) {
                  setSaveError(errorMessage(error))
                }
              }}
              cursorOffset={baseUrlCursorOffset}
              onChangeCursorOffset={setBaseUrlCursorOffset}
              columns={62}
              showCursor
              focus
            />
          </Box>
        </Box>
      ) : null}

      {phase === 'apiKey' ? (
        <Box flexDirection="column" gap={1}>
          <Text>Enter the API key for that endpoint:</Text>
          <Box>
            <Text dimColor>Key &gt; </Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={value => {
                if (!value.trim()) {
                  setSaveError('API key is required.')
                  return
                }

                setApiKey(value.trim())
                setSaveError(null)
                setPhase('model')
              }}
              cursorOffset={apiKeyCursorOffset}
              onChangeCursorOffset={setApiKeyCursorOffset}
              columns={62}
              showCursor
              focus
              mask="*"
            />
          </Box>
        </Box>
      ) : null}

      {phase === 'model' ? (
        <Box flexDirection="column" gap={1}>
          <Text>Enter the model name your endpoint expects:</Text>
          <Box>
            <Text dimColor>Model &gt; </Text>
            <TextInput
              value={modelName}
              onChange={setModelName}
              onSubmit={value => {
                const trimmed = value.trim()
                if (!trimmed) {
                  setSaveError('Model name is required.')
                  return
                }

                setModelName(trimmed)
                setSaveError(null)
                setPhase('confirm')
              }}
              cursorOffset={modelNameCursorOffset}
              onChangeCursorOffset={setModelNameCursorOffset}
              columns={62}
              showCursor
              focus
            />
          </Box>
        </Box>
      ) : null}

      {phase === 'confirm' ? (
        <Box flexDirection="column" gap={1}>
          <Text>Save this configuration?</Text>
          <Text>
            Endpoint: <Text bold>{normalizeDisplayUrl(baseUrl)}</Text>
          </Text>
          <Text>
            API key: <Text bold>{maskedApiKey}</Text>
          </Text>
          <Text>
            Model: <Text bold>{modelName.trim()}</Text>
          </Text>
          <Select
            options={[
              { label: 'Save and continue', value: 'save' },
              { label: 'Edit endpoint', value: 'endpoint' },
              { label: 'Edit API key', value: 'apiKey' },
              { label: 'Edit model', value: 'model' },
              { label: 'Back', value: 'back' },
            ]}
            onChange={value => {
              switch (value) {
                case 'save':
                  void handleSave()
                  break
                case 'endpoint':
                  setSaveError(null)
                  setPhase('endpoint')
                  break
                case 'apiKey':
                  setSaveError(null)
                  setPhase('apiKey')
                  break
                case 'model':
                  setSaveError(null)
                  setPhase('model')
                  break
                default:
                  onBack()
              }
            }}
            onCancel={onBack}
          />
        </Box>
      ) : null}

      {saveError ? <Text color="error">{saveError}</Text> : null}

      {phase !== 'confirm' ? (
        <Text dimColor>
          Press Enter to continue. You can go back from the confirmation step.
        </Text>
      ) : null}
    </Box>
  )
}

function normalizeEndpoint(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error('Endpoint URL is required.')
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Enter a valid http:// or https:// endpoint URL.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Endpoint URL must start with http:// or https://.')
  }

  return parsed.toString().replace(/\/+$/, '')
}

function normalizeDisplayUrl(value: string): string {
  try {
    return normalizeEndpoint(value)
  } catch {
    return value.trim()
  }
}

function normalizeModelName(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error('Model name is required.')
  }

  return trimmed
}

function clearStoredOAuthTokens(): void {
  const secureStorage = getSecureStorage()
  const storageData = secureStorage.read() || {}

  if ('claudeAiOauth' in storageData) {
    delete storageData.claudeAiOauth
    secureStorage.update(storageData)
  }

  clearOAuthTokenCache()
}
