import { getJestProjects } from '@nrwl/jest'

export default {
  projects: getJestProjects(),
  transformIgnorePatterns: ['<rootDir>/node_modules/'],
}
