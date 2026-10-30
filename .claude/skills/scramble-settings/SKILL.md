---
name: scramble-settings
description: Installation-wide settings in scramble-proto — the Rust `Settings` config (.config.toml), the get/save/set_api_key/clear_api_key commands, the write-only NCBI API key, `SettingsService`'s draft/save model, the Settings modal with its section panes, layered move grid and unsaved-changes guard. Use when touching settings, the config file, the API key, theme/work-folder options, or the Settings modal.
---

# Settings

One set of settings per installation (no user profile). Theme and work folder are a draft that
**Save** writes; the API key is write-only and committed immediately.

## Backend (`src-tauri/src/user/data.rs`, commands in `lib.rs`)

- `Settings { theme, work_dir, last_session_path, api_key, api_key_updated_at }` is persisted as
  `<data dir>/.config.toml`. `#[serde(default)]`: unknown keys are ignored, missing keys default.
  It holds the key, so it is **never** sent over IPC.
- Managed as `SettingsState { data: Mutex<Settings>, config_path }`. The backend owns the config
  path; the frontend only displays it.
- `load_config` fills an empty `work_dir` with `default_work_dir` (`<data dir>/work`).
- Key resolution (`Settings::api_key()`): configured key, else `NCBI_API_KEY`. The env key is
  never written to the config.

IPC views (each mirrors `types/data_types.ts`):

| Rust | Shape |
|---|---|
| `SettingsInfo` | `theme`, `workDir`, `lastSessionPath`, `configPath`, `apiKey: ApiKeyStatus` |
| `ApiKeyStatus` | `available`, `source: "Config" \| "Env" \| null`, `updatedAt` (null for Env) |
| `SettingsDraft` | `theme`, `workDir`, `lastSessionPath` (what Save sends) |

| Command | Args | Returns | Notes |
|---|---|---|---|
| `get_settings` | | `SettingsInfo` | |
| `save_settings` | `draft` | `SettingsInfo` | Work dir must be non-empty and absolute; `create_dir_all`, then writes the config |
| `set_api_key` | `key` | `ApiKeyStatus` | Trims, rejects empty, stamps `api_key_updated_at`, saves |
| `clear_api_key` | | `ApiKeyStatus` | Removes the config key (an env key can keep it `available`), saves |

Mutating commands apply to a clone and only swap it into the state after the file write succeeds.

Tests: `ipc_json_matches_frontend_settings_info` pins the keys, `settings_info_never_contains_the_key`,
key-source precedence, TOML round-trip, old/partial configs; `tests/ipc.rs` covers
`set_api_key`/`clear_api_key` through `get_settings`.

## Frontend

**`SettingsService`** (`services/settings-service.ts`, `init` in `provideAppInitializer`):
- `saved` (read-only `SettingsInfo`), writable `draftTheme` / `draftWorkDir` for direct binding.
- `dirtySections` (`Appearance` for theme, `Scramble` for work dir) and `dirty`.
- `save()` rejects with the backend message; `revert()` resets the draft;
  `setApiKey` / `clearApiKey` patch only `saved().apiKey`. The key is never kept in a signal.
- Other code reads `settings.saved()` directly (e.g. key availability).

**Modal** (`components/pop-up/modal/settings/`, route `modal/settings`):
- 30% / 70% split: section list (icon + label, `●` when dirty) with Save at the bottom, and the
  active section pane: `settings-scramble` (config path, work dir input), `settings-appearance`
  (theme drop down), `settings-ncbi` (key status, masked input, Set / Remove).
- Section ids and sub-grids: `settingsBaseGrid`, `settingsSectionIds`, `settingsSubGrids` in
  `move-grids/mv-grids-modals.ts`. A sub-grid must not be taller than the base (4 rows).
- The component loads `loadLayeredGrid(base, sub, anchor)` whenever focus returns to the modal,
  and swaps the sub-grid (`setSubGrid`) as soon as the cursor lands on a section (live) or a
  section is clicked. Layer movement rules live in the frontend skill.
- Enter is handled in `LayoutService.handleEnter`, `case "Settings"`: on a section it moves into
  the sub-grid; otherwise it triggers the button / drop down / input.
- Icons: `icon-settings` (navbar gear), `icon-scramble-settings`, `icon-appearance-settings`,
  `icon-ncbi-settings`; all take `svg_color`.

**Unsaved-changes guard** (`LayoutService._mayLeaveSettings`, used by `toggleModal`,
`closeModal`, `closeAllModals`): leaving with `dirty()` warns once
(`Unsaved settings. Esc again to discard, or Save`); the next attempt reverts and closes.
Opening a modal or pressing Enter inside Settings disarms it.

**Entry points**: navbar gear, leader `s`, `:set`.

## Not done yet

Applying the theme (IMPLEMENT.md task 9; only the dropdown and persistence exist), a native folder
picker for the work dir, OS keyring for the key, using `lastSessionPath`.
