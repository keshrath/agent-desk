// HTTP equivalent of the desktop's protocol.handle('plugin', …):
// serves plugin static assets from each plugin's dist/ui directory.

import { readFileSync } from 'fs';
import type { Request, Response } from 'express';
import { resolvePluginAsset, type LoadedPlugin } from '@agent-desk/core';

export function makePluginAssetHandler(plugins: LoadedPlugin[]) {
  return (req: Request, res: Response): void => {
    const params = req.params as unknown as { id: string; '0': string };
    const pluginId = params.id;
    const filePath = params['0'] || '';
    const asset = resolvePluginAsset(plugins, pluginId, filePath);
    if (!asset) {
      res.status(404).send('Not found');
      return;
    }
    try {
      const content = readFileSync(asset.absPath);
      res.setHeader('Content-Type', asset.mimeType);
      res.send(content);
    } catch {
      res.status(500).send('Read failed');
    }
  };
}
