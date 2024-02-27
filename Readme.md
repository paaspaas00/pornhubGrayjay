# Basic PornHub Plugin for Grayjay the app

## Basic workflow is working fine :smiley:

## Try it

### Method one:

Follow this for development [plugin-development.md](https://gitlab.futo.org/videostreaming/grayjay/-/blob/master/plugin-development.md)

### Method two

- Run a local HTTP server with:

    ```bash
    cd <PLUGIN_ROOT>
    sudo python3 -m http.server -b 0.0.0.0 8080
    ```

    8080 will be `<PORT>`

- Change the `sourceUrl` in `PornhubConfig.json` file to "`<PC_ADDRESS>:<PORT>/PornhubConfig.json`"

- Create a QR code with: "`grayjay://plugin/http://<PC_ADDRESS>:<PORT>/PornhubConfig.json`"

- Scan the QR code via the app

## What's working:

- Channels search
- Channel subscribe/unsubscribe (partially)
- Channel info fetch (description, about, its videos)
- Search suggestions
- Video download (HLS)
- Video search
- Video playback
- Video info
- View profiles for models, pornstars, and channels
- Fetching video comments with like/dislike, avatar, etc. (only non-nested ones)

## What's not working:

- Subtitles
- Video quality selection
- Per-channel video search
- Search filters
- Premium login
- ...all the rest

## Contribute guys!!!

