// @services/face.ts
import http from '@services/http';

export const getFaceStatus = () =>
  http.get('/face/status').then(r => r.data as { enrolled: boolean; count: number });

export const resetFace = () =>
  http.post('/face/reset').then(r => r.data as { ok: boolean; deleted: number });
