interface Config {
    token:string,
    input:{
        /** Channel IDs of where to listen for messages */
        channel_ids:string[]
    },
    guild_id:string,
    developer?:{
        bypassFlagCheck:boolean
    },
    whitelisted:string[]
}

interface FeedbackResponse {
    content:string,
    author_id:string,
    author_tag:string,
    id:string,
    removed?:boolean
}

interface Feedback {
    content:string,
    author_id:string,
    channel_id:string,
    user_message_id:string,
    bot_message_id:string,
    responses?:FeedbackResponse[],
    id:string,
    removed?:boolean
}