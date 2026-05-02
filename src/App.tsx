import { useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { colors, fonts } from './theme.stylex';

import reactLogo from './assets/react.svg';
import viteLogo from './assets/vite.svg';
import heroImg from './assets/hero.png';
import './index.css';

const MOBILE = '@media (max-width: 1024px)';
const DARK = '@media (prefers-color-scheme: dark)';

const s = stylex.create({
  root: {
    fontFamily: fonts.sans,
    fontSize: { default: '18px', [MOBILE]: '16px' },
    lineHeight: '145%',
    letterSpacing: '0.18px',
    colorScheme: 'light dark',
    color: colors.text,
    backgroundColor: colors.bg,
    width: '1126px',
    maxWidth: '100%',
    margin: '0 auto',
    textAlign: 'center',
    
    // ATENÇÃO: StyleX não aceita `1px solid ${colors.border}`. Precisamos separar:
    borderInlineWidth: '1px',
    borderInlineStyle: 'solid',
    borderInlineColor: colors.border,
    
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    gap: { default: '25px', [MOBILE]: '18px' },
    placeContent: 'center',
    placeItems: 'center',
    flexGrow: 1,
    padding: { default: 0, [MOBILE]: '32px 20px 24px' },
  },
  hero: { position: 'relative' },
  heroImageCommon: {
    insetInline: 0,
    margin: '0 auto',
  },
  base: {
    width: '170px',
    position: 'relative',
    zIndex: 0,
  },
  absolute: { position: 'absolute' },
  framework: {
    zIndex: 1,
    top: '34px',
    height: '28px',
    transform: 'perspective(2000px) rotateZ(300deg) rotateX(44deg) rotateY(39deg) scale(1.4)',
  },
  vite: {
    zIndex: 0,
    top: '107px',
    height: '26px',
    width: 'auto',
    transform: 'perspective(2000px) rotateZ(300deg) rotateX(40deg) rotateY(39deg) scale(0.8)',
  },
  h1: {
    fontFamily: fonts.heading,
    fontWeight: 500,
    color: colors.textH,
    fontSize: { default: '56px', [MOBILE]: '36px' },
    letterSpacing: '-1.68px',
    margin: { default: '32px 0', [MOBILE]: '20px 0' },
  },
  h2: {
    fontFamily: fonts.heading,
    fontWeight: 500,
    color: colors.textH,
    fontSize: { default: '24px', [MOBILE]: '20px' },
    lineHeight: '118%',
    letterSpacing: '-0.24px',
    margin: '0 0 8px',
  },
  p: { margin: 0 },
  code: {
    fontFamily: fonts.mono,
    display: 'inline-flex',
    borderRadius: '4px',
    color: colors.textH,
    fontSize: '15px',
    lineHeight: '135%',
    padding: '4px 8px',
    backgroundColor: colors.codeBg,
  },
  counter: {
    fontFamily: fonts.mono,
    display: 'inline-flex',
    fontSize: '16px',
    padding: '5px 10px',
    borderRadius: '5px',
    color: colors.accent,
    backgroundColor: colors.accentBg,
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: { default: 'transparent', ':hover': colors.accentBorder },
    transition: 'border-color 0.3s',
    marginBottom: '24px',
    outlineWidth: { ':focus-visible': '2px' },
    outlineStyle: { ':focus-visible': 'solid' },
    outlineColor: { ':focus-visible': colors.accent },
    outlineOffset: { ':focus-visible': '2px' },
  },
  ticks: {
    position: 'relative',
    width: '100%',
    '::before': {
      content: '""',
      position: 'absolute',
      top: '-4.5px',
      borderWidth: '5px',
      borderStyle: 'solid',
      borderColor: 'transparent',
      left: 0,
      borderLeftColor: colors.border,
    },
    '::after': {
      content: '""',
      position: 'absolute',
      top: '-4.5px',
      borderWidth: '5px',
      borderStyle: 'solid',
      borderColor: 'transparent',
      right: 0,
      borderRightColor: colors.border,
    },
  },
  nextSteps: {
    display: 'flex',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: colors.border,
    textAlign: { default: 'left', [MOBILE]: 'center' },
    flexDirection: { default: 'row', [MOBILE]: 'column' },
  },
  nextStepsChild: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    padding: { default: '32px', [MOBILE]: '24px 20px' },
  },
  docs: {
    borderRightWidth: { default: '1px', [MOBILE]: 0 },
    borderRightStyle: { default: 'solid', [MOBILE]: 'none' },
    borderRightColor: { default: colors.border, [MOBILE]: 'transparent' },
    borderBottomWidth: { default: 0, [MOBILE]: '1px' },
    borderBottomStyle: { default: 'none', [MOBILE]: 'solid' },
    borderBottomColor: { default: 'transparent', [MOBILE]: colors.border },
  },
  icon: {
    marginBottom: '16px',
    width: '22px',
    height: '22px',
  },
  ul: {
    listStyle: 'none',
    padding: 0,
    display: 'flex',
    gap: '8px',
    margin: { default: '32px 0 0', [MOBILE]: '20px 0 0' },
    flexWrap: { default: 'nowrap', [MOBILE]: 'wrap' },
    justifyContent: { default: 'flex-start', [MOBILE]: 'center' },
  },
  li: {
    flex: { default: '0 1 auto', [MOBILE]: '1 1 calc(50% - 8px)' },
  },
  link: {
    color: colors.textH,
    fontSize: '16px',
    borderRadius: '6px',
    backgroundColor: colors.socialBg,
    display: 'flex',
    padding: '6px 12px',
    alignItems: 'center',
    gap: '8px',
    textDecoration: 'none',
    transition: 'box-shadow 0.3s',
    boxShadow: { ':hover': colors.shadow },
    width: { default: 'auto', [MOBILE]: '100%' },
    justifyContent: { default: 'flex-start', [MOBILE]: 'center' },
    boxSizing: { default: 'content-box', [MOBILE]: 'border-box' },
  },
  logo: { height: '18px' },
  buttonIcon: {
    height: '18px',
    width: '18px',
  },
  socialIconFilter: {
    filter: { default: 'none', [DARK]: 'invert(1) brightness(2)' },
  },
  spacer: {
    height: { default: '88px', [MOBILE]: '48px' },
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: colors.border,
  },
});

function App() {
  const [count, setCount] = useState(0);

  return (
    <div {...stylex.props(s.root)}>
      <section {...stylex.props(s.center)}>
        <div {...stylex.props(s.hero)}>
          <img src={heroImg} {...stylex.props(s.heroImageCommon, s.base)} width="170" height="179" alt="" />
          <img src={reactLogo} {...stylex.props(s.heroImageCommon, s.absolute, s.framework)} alt="React logo" />
          <img src={viteLogo} {...stylex.props(s.heroImageCommon, s.absolute, s.vite)} alt="Vite logo" />
        </div>
        <div>
          <h1 {...stylex.props(s.h1)}>Get started</h1>
          <p {...stylex.props(s.p)}>
            Edit <code {...stylex.props(s.code)}>src/App.tsx</code> and save to test <code {...stylex.props(s.code)}>HMR</code>
          </p>
        </div>
        <button
          type="button"
          {...stylex.props(s.counter)}
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div {...stylex.props(s.ticks)}></div>

      <section {...stylex.props(s.nextSteps)}>
        <div {...stylex.props(s.nextStepsChild, s.docs)}>
          <svg {...stylex.props(s.icon)} role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2 {...stylex.props(s.h2)}>Documentation</h2>
          <p {...stylex.props(s.p)}>Your questions, answered</p>
          <ul {...stylex.props(s.ul)}>
            <li {...stylex.props(s.li)}>
              <a href="https://vite.dev/" target="_blank" {...stylex.props(s.link)}>
                <img {...stylex.props(s.logo)} src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li {...stylex.props(s.li)}>
              <a href="https://react.dev/" target="_blank" {...stylex.props(s.link)}>
                <img {...stylex.props(s.buttonIcon)} src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        
        <div {...stylex.props(s.nextStepsChild)}>
          <svg {...stylex.props(s.icon)} role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2 {...stylex.props(s.h2)}>Connect with us</h2>
          <p {...stylex.props(s.p)}>Join the Vite community</p>
          <ul {...stylex.props(s.ul)}>
            <li {...stylex.props(s.li)}>
              <a href="https://github.com/vitejs/vite" target="_blank" {...stylex.props(s.link)}>
                <svg {...stylex.props(s.buttonIcon, s.socialIconFilter)} role="presentation" aria-hidden="true">
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li {...stylex.props(s.li)}>
              <a href="https://chat.vite.dev/" target="_blank" {...stylex.props(s.link)}>
                <svg {...stylex.props(s.buttonIcon, s.socialIconFilter)} role="presentation" aria-hidden="true">
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li {...stylex.props(s.li)}>
              <a href="https://x.com/vite_js" target="_blank" {...stylex.props(s.link)}>
                <svg {...stylex.props(s.buttonIcon, s.socialIconFilter)} role="presentation" aria-hidden="true">
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li {...stylex.props(s.li)}>
              <a href="https://bsky.app/profile/vite.dev" target="_blank" {...stylex.props(s.link)}>
                <svg {...stylex.props(s.buttonIcon, s.socialIconFilter)} role="presentation" aria-hidden="true">
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div {...stylex.props(s.ticks)}></div>
      <section {...stylex.props(s.spacer)}></section>
    </div>
  );
}

export default App;
