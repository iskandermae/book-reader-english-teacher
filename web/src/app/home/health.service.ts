import { Injectable } from '@angular/core';
import { getApiHealth } from '../api';

/** Thin wrapper over the generated client so components can be tested without HTTP. */
@Injectable({ providedIn: 'root' })
export class HealthService {
  async isOk(): Promise<boolean> {
    const { data } = await getApiHealth();
    return data?.status === 'ok';
  }
}
