# Locale

The Locale component manages the player's translation layer. It stores and resolves locale data, enables the registration of custom locales before instance creation, and provides a runtime translation function. This component does not affect UI layout directly but underpins all text translations in UI components.

## Configuration

Configuration example with defaults:

```javascript
const playerConfig = {
    locale: {
        lang: defaultLocale // `defaultLocale` = available locale is matching with browser language or 'en' if not.
    }
};
```

| Setting Name | Type   | Description                                                  |
| ------------ | ------ | ------------------------------------------------------------ |
| `lang`       | String | Sets the default UI language. Affects which locale is used for translation. If not present, the player tries to find the best suitable locale based on browser language, with a final fallback to `'en'`. |

## API

| **Method**                | **Arguments**                                    | **Returns** | **Description**                                              |
| ------------------------- | ------------------------------------------------ | ----------- | ------------------------------------------------------------ |
| `locale.t`                | `path`&nbsp;(String)                             | String      | Returns the translated value based on the given key / path.  |
| `locale.getLocalizedTime`             | `timeArg`&nbsp;(Number)                          | String      | This method takes a time value in seconds and converts it to a human-readable format,  applying language-specific singular or plural forms for hours, minutes, and seconds, depending on the current locale. |
| `locale.getNativeLang`       | `lang`&nbsp;(String)                             | String      | Translates a language identifier (ISO 639-3 or legacy code) to its native language name. If no translation is available, the original language code is returned. |
| **Static API**            |                                                  |             |                                                              |
| `Player.addLocale`        | `translations`&nbsp;(Object)                     |             | Adds or merges a set of translation objects at runtime. The translations object should have corresponding language codes at the root level, e.g. ( "de": ( … ), "fr": ( … ) ). Not available in the secure build. |
| `Player.setDefaultLocale` | `lang`&nbsp;(String)                             |             | Sets the default locale for the player globally (before instantiation). |
| `Player.setLocaleConfig`  | `lang`&nbsp;(String)<br />`config`&nbsp;(Object) |             | Sets a config for a certain locale. Currently, specifying RTL languages (like Arabic) is supported, by using this config: ( rtl: true ). Not available in the secure build. |
