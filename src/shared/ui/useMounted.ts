'use client';
import { useEffect, useState } from 'react';
export default function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}