import { reseed } from './reseed';

export default async function globalSetup(): Promise<void> {
  reseed();
}
