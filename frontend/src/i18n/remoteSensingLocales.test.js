import { REMOTE_SENSING_LOCALE_LOADERS } from './remoteSensingLocales';
import { SUPPORTED_LANGUAGES } from './config';
import english from './locales/remote-sensing/en.json';

test.each(Object.keys(SUPPORTED_LANGUAGES))('%s has a complete static Field Intelligence pack', async code => {
  const pack=await REMOTE_SENSING_LOCALE_LOADERS[code]();
  expect(Object.keys(pack.remoteSensing)).toEqual(Object.keys(english.remoteSensing));
  for (const value of Object.values(pack.remoteSensing)) {
    expect(typeof value).toBe('string'); expect(value.trim().length).toBeGreaterThan(0);
    expect(value).not.toMatch(/ZXQ\d+QXZ|\[90{7,}\d+\]/);
  }
  if(code!=='en') expect(pack.remoteSensing.intro).not.toBe(english.remoteSensing.intro);
});
