import React, { type PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

/**
 * Root HTML for Expo Router web export.
 * Configured for complete responsiveness on all mobile phones (iOS Safari & Android Chrome).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="theme-color" content="#131016" />
        <title>FNAAD Art</title>

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: responsiveResetStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveResetStyles = `
*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  width: 100%;
  min-height: 100%;
  min-height: 100dvh;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  -webkit-text-size-adjust: 100%;
  touch-action: manipulation;
}

body {
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#root {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100%;
  min-height: 100dvh;
  flex: 1;
}

/* Prevent iOS Safari auto-zoom on input focus by keeping font size legible on touch devices */
@media screen and (max-width: 767px) {
  input, select, textarea {
    font-size: 16px !important;
  }
}
`;
