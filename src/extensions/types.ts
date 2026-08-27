export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entry: string;
}

export interface ExtensionModule {
  getDaySubLabel?(date: Date): string | undefined;
}
