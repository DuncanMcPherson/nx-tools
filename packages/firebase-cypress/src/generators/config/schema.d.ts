export interface ConfigGeneratorSchema {
  projects: string | string[];
  useJavascript?: boolean;
  directory?: string;
  bundler?: 'vite' | 'webpack';
  baseUrl?: string;
}
