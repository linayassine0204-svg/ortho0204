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
  randomUUID: () => crypto.randomUUID(),
}));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
vi.mock("@react-native-community/netinfo", () => ({
  default: { addEventListener: () => () => undefined },
}));
vi.mock("expo-audio", () => ({
  useAudioPlayer: () => ({ play: vi.fn(), pause: vi.fn(), seekTo: vi.fn() }),
  useAudioPlayerStatus: () => ({
    playing: false,
    didJustFinish: false,
    duration: 0,
    currentTime: 0,
  }),
}));
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: vi.fn() }));
vi.mock("expo-file-system", () => ({}));
vi.mock("react-native-safe-area-context", async () => {
  const { View } = await import("react-native");
  return { SafeAreaProvider: View, SafeAreaView: View };
});

afterEach(() => {
  cleanup();
});
