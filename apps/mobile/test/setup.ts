import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Les composants React Native sont rendus avec react-native-web (alias dans
// vitest.config.ts). Les modules natifs d'Expo sont remplacés : les tests passent
// leurs propres dépendances (coffre et stockage en mémoire, faux serveur).

vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 0,
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock("expo-crypto", () => ({
  getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("react-native-safe-area-context", async () => {
  const { View } = await import("react-native");
  return { SafeAreaProvider: View, SafeAreaView: View };
});

afterEach(() => {
  cleanup();
});
