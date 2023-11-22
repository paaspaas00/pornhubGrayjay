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
- Video search
- Video playback
- Video info
- Fetching video comments with like/dislike, avatar, etc. (only non-nested ones)

## What's not working:

- Subtitles
- Search suggestions (added facility but don't really know)
- Video download (added facility but link returns nothing, maybe requires premium?)
- Per-channel video search
- Creators can also be models and pornstars, add search, info fetch, etc. like for channels
- Premium login
- ...all the rest

## Contribute guys!!!
