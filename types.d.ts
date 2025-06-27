export type HomeContext = {
    next?: string
}

export type ChannelContext = {
    next?: string
    id: string
}

export type SearchContext = {
    page: number
    q: string
}

export type SearchChannelContext = {
    next?: string
    q: string
}

type AssetType = {
    original: string
    webp: string
}

type Category = {
    id: string
    type: 'category'
    slug: string
    title: string
    assets: {
        avatar: string
        'avatar-big-dark': string
        'avatar-big-light': string
    }
    images: {
        thumbnail?: string
        avatar: {
            formats: string[]
            width: number
            height: number
            src: string
        }
        'avatar-big-dark': {
            formats: string[]
            width: number
            height: number
            src: string
        }
        'avatar-big-light': {
            formats: string[]
            width: number
            height: number
            src: string
        }
    }
}

type Channel = {
    id: string
    type: 'video_channel'
    slug: string
    slug_aliases: string[]
    title: string
    published_at: string
    description: string
    assets: {
        avatar: {
            16: AssetType
            32: AssetType
            64: AssetType
            128: AssetType
            256: AssetType
            512: AssetType
        }
        banner: {
            240: AssetType
            360: AssetType
            480: AssetType
            720: AssetType
            960: AssetType
            1440: AssetType
            1920: AssetType
            2560: AssetType
        }
        featured: {
            240: AssetType
            360: AssetType
            480: AssetType
            720: AssetType
            960: AssetType
            1440: AssetType
            1920: AssetType
            2560: AssetType
        }
    }
    images: {
        avatar: {
            formats: string[]
            width: number
            height: number
            src: string
        }
        banner: {
            formats: string[]
            width: number
            height: number
            src: string
        }
        featured: {
            formats: string[]
            width: number
            height: number
            src: string
        }
    }
    genre_category_title: string
    genre_category_slug: string
    genre_category_id: string
    categories: Category[]
    website?: string
    patreon?: string
    twitter?: string
    instagram?: string
    facebook?: string
    merch?: string
    merch_collection: string
    share_url: string
    engagement?: any
    playlists: {
        id: string
        type: 'video_playlist'
        slug: string
        title: string
    }[]
    zype_id?: string
    exclusivity?: string
}

type Content = {
    id: string
    type: 'video_episode'
    slug: string
    title: string
    description: string
    short_description: string
    duration: number
    duration_to_complete: number
    published_at: string
    channel_id: string
    channel_slug: string
    channel_slugs: string[]
    channel_title: string
    category_slugs: string[]
    images: {
        channel_avatar: {
            formats: string[]
            width: number
            height: number
            src: string
        }
        thumbnail: {
            formats: string[]
            width: number
            height: number
            src: string
        }
    }
    engagement?: any
    attributes: string[]
    share_url: string
    primary_channel?: string
    zype_id?: string
}

type ResponseWrapper<T> = {
    next: string
    previous?: string
    results: T[]
}

export type HomeResponse = ResponseWrapper<Content>
export type SearchResponse = ResponseWrapper<Content>
export type ChannelContentResponse = ResponseWrapper<Content>
export type SearchChannelResponse = ResponseWrapper<Channel>
export type SubscriptionResponse = ResponseWrapper<Channel>

export type ContentDetail = Content & {
    primary_channel: Channel
}
