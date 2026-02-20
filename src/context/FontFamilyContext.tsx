import React, { createContext, useContext } from 'react';

interface FontFamilyContextValue {
  fontFamily?: string;
}

const FontFamilyContext = createContext<FontFamilyContextValue>({});

export const FontFamilyProvider: React.FC<{
  fontFamily?: string;
  children: React.ReactNode;
}> = ({ fontFamily, children }) => {
  return (
    <FontFamilyContext.Provider value={{ fontFamily }}>
      {children}
    </FontFamilyContext.Provider>
  );
};

export const useFontFamily = () => {
  const { fontFamily } = useContext(FontFamilyContext);

  const fontStyle = fontFamily
    ? ({ fontFamily, fontWeight: 'normal' } as const)
    : null;

  return { fontFamily, fontStyle };
};
