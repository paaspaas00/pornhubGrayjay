# Basic PornHub Plugin for Grayjay the app

## Basic workflow is working fine :smiley:

## Try it

GrayJay -> Sources -> +
And scan this QR code

![qr-code (1)](https://github.com/paaspaas00/pornhubGrayjay/assets/151774837/3c29f233-deb9-46ec-9c1a-fcdf017a9815)


### Method one:

Follow this for development [plugin-development.md](https://gitlab.futo.org/videostreaming/grayjay/-/blob/master/plugin-development.md)

### Method two (easy, just temporary deploy)

- Run a local HTTP server with:

    ```bash
    cd <PLUGIN_ROOT>
    sudo python3 -m http.server -b 0.0.0.0 8080
    ```

    or, if **on Windows**, first install Python via the Microsoft Store or via Anaconda or from the official site, then
    ```bat
    cd <PLUGIN_ROOT>
    python -m http.server -b 0.0.0.0 8080
    ```

    8080 will be `<PORT>`

- Change the `sourceUrl` in `PornhubConfig.json` file to `http://<PC_ADDRESS>:<PORT>/PornhubConfig.json`

- Create a QR code with: `http://<PC_ADDRESS>:<PORT>/PornhubConfig.json` from [here](https://www.qrcode-monkey.com/) or wherever

- In Grayjay, go to `Sources`, tap the `+`, scan the QR code and install

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

