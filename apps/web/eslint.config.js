import { baseConfig } from '@finders-eaters/config/eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default [...baseConfig, reactHooks.configs.flat['recommended-latest']]
