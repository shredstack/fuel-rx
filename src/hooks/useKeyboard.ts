'use client';

import { useEffect, useState } from 'react';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

interface KeyboardState {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
}

export function useKeyboard(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({
    keyboardHeight: 0,
    isKeyboardVisible: false,
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
      setState({
        keyboardHeight: info.keyboardHeight,
        isKeyboardVisible: true,
      });
    });

    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setState({
        keyboardHeight: 0,
        isKeyboardVisible: false,
      });
    });

    return () => {
      showListener.then(l => l.remove());
      hideListener.then(l => l.remove());
    };
  }, []);

  return state;
}

export async function hideKeyboard(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Keyboard.hide();
  }
}

export async function showKeyboard(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Keyboard.show();
  }
}
