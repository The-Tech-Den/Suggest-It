import {ButtonInteraction, Client, Message, MessageButton, MessageEmbed, TextChannel} from 'discord.js';
import Store from './store';
import config from '../config';
import { feedbackSubmittedEmbed, submittingFeedbackEmbed } from './structures/Embeds';
import { cancelFeedbackButton } from "./structures/Buttons";
import {readFileSync, writeFileSync, existsSync} from 'fs';

//Check if feedback.json exists
if(!existsSync("./feedback.json"))
    writeFileSync("./feedback.json", JSON.stringify([]))

const client = new Client({intents:["GUILDS", "GUILD_MESSAGES"]});
const cooldown = new Store();

client.once("ready", () => {
    console.log(`${client.user.tag} is ready to listen for feedback.`)
    if(existsSync("./commands_created.flag") && (!config.developer || !config.developer.bypassFlagCheck))return;
    client.guilds.cache.get(config.guild_id as `${bigint}`).commands.create({
        "name":"respond",
        "description":"(Staff only) Respond to an incoming feedback message.",
        "options":[
            {
                "type":"STRING",
                "name":"id",
                "description":"The Feedback ID",
                "required":true
            },
            {
                "type":"STRING",
                "name":"response",
                "description":"Your response to the feedback post",
                "required":true
            }
        ]
    });
    writeFileSync("./commands_created.flag", "true")
})

//Incoming feedback
client.on("messageCreate", (message:Message) => {
    if(message.author.bot)return;
    if(!config.input.channel_ids.includes(message.channel.id))return;
    if(!cooldown.sessionExists(message.author.id)){
        cooldown.start(message.author.id)
        message.reply({"embeds":[submittingFeedbackEmbed]}).then(m => {
            let feedbackList:Feedback[] = JSON.parse(readFileSync("./feedback.json").toString());
            let newFeedback:Feedback = {
                "author_id":message.author.id,
                "bot_message_id":m.id,
                "channel_id":message.channel.id,
                "content":message.content,
                "user_message_id":message.id,
                "id":`${feedbackList.length+1}`
            };
            feedbackList.push(newFeedback);
            writeFileSync("./feedback.json", JSON.stringify(feedbackList));
            let button = cancelFeedbackButton;
            button.customId = `close_${newFeedback.id}`;
            let embed = feedbackSubmittedEmbed;
            embed.setFooter(`Feedback ID: ${newFeedback.id}`)
            m.edit({embeds:[embed], components:[{type:1, components:[cancelFeedbackButton]}]})
        });
    }else{
        if(message.guild.me.permissionsIn(message.channel.id).has("MANAGE_MESSAGES"))
            message.delete();
        message.channel.send({"content":`<@${message.author.id}>: Please wait to try again <t:${Math.floor(cooldown.getCooldownEndTime(message.author.id) / 1000)}:R> before submitting again...`}).then((m) => {
            setTimeout(() => {
                m.delete();
            }, 3000);
        });
    };
});

client.on("interactionCreate", (interaction) => {
    //Cancel Feedback
    if(interaction.isButton() && interaction.customId.startsWith("close")){
        let feedbackID = interaction.customId.split("_")[1];
        let feedbackList:Feedback[] = JSON.parse(readFileSync("./feedback.json").toString());
        if(!feedbackList.find(f => f.id == feedbackID))
            return interaction.reply({"content":"Uh oh, I can't find that feedback ID. Please try again later. If the issue persists, contact the bot developer.", ephemeral:true});
        if(!feedbackList.find(f => f.id == feedbackID && f.author_id == interaction.member.user.id))
            return interaction.reply({"content":"This doesn't appear to be your feedback message. So, the action you just attempted was denied.", ephemeral:true})
        let feedbackPost:Feedback = feedbackList.find(f => f.id == feedbackID && f.author_id == interaction.member.user.id);
        if(interaction.guild.me.permissionsIn(interaction.channelId).has("MANAGE_MESSAGES")){
            console.log(feedbackPost)
            console.log((`${feedbackPost.bot_message_id as `${bigint}`}`));
            (interaction.guild.channels.cache.get(interaction.channelId) as TextChannel).messages.fetch((`${feedbackPost.bot_message_id as `${bigint}`}`)).then(m => m.delete());
            (interaction.guild.channels.cache.get(interaction.channelId) as TextChannel).messages.fetch((`${feedbackPost.user_message_id as `${bigint}`}`)).then(m => m.delete());
        }
        feedbackList = feedbackList.map(f => {
            if(f.id == feedbackID){
                f.author_id = "";
                f.bot_message_id = "";
                f.channel_id = "";
                f.content = "";
                f.removed = true;
                f.user_message_id = "";
            };
            return f;
        });
        writeFileSync("./feedback.json", JSON.stringify(feedbackList));
        return interaction.reply({"content":"Your feedback post has been removed. Please note, if you were on cooldown, this does **not** reset the cooldown period.", ephemeral:true});
    };

    //Respond to feedback
    if(interaction.isCommand() && interaction.commandName == "respond"){
        if(!config.whitelisted.includes(interaction.member.user.id))
            return interaction.reply({"content":"You aren't whitelisted to use this feature.", ephemeral:true})
        if(config.input.channel_ids.includes(interaction.channelId))
            return interaction.reply({content:`Please do not run this command in a feedback input channel.\nYour response:\n> ${interaction.options.data[1].value.toString()}`, "ephemeral":true})
        let feedbackID = interaction.options.data[0].value.toString()
        let feedbackList:Feedback[] = JSON.parse(readFileSync("./feedback.json").toString());
        if(!feedbackList.find(f => f.id == feedbackID))
            return interaction.reply({"content":"Uh oh, I can't find that feedback ID. Make sure you typed the ID correctly. If the issue persists, contact the bot developer.", ephemeral:true});
        let feedbackPost:Feedback = feedbackList.find(f => f.id == feedbackID);
        if(feedbackPost.responses && feedbackPost.responses.length == 9)
            return interaction.reply({"content":"This feedback post already has the max amount of responses."})
        const response:FeedbackResponse = {
            "content":interaction.options.data[1].value.toString(),
            "author_id":interaction.member.user.id,
            "author_tag":`${interaction.member.user.username}#${interaction.member.user.discriminator}`,
            "id":`${feedbackPost.responses && feedbackPost.responses.length+1 || 1}`
        };
        if(!feedbackPost.responses)
            feedbackPost.responses = [];
        feedbackPost.responses.push(response);
        let newEmbeds:MessageEmbed[] = [];
        interaction.defer().then(() => {
            (interaction.guild.channels.cache.get(feedbackPost.channel_id as `${bigint}`) as TextChannel).messages.fetch((`${feedbackPost.bot_message_id as `${bigint}`}`)).then(m => {
                newEmbeds.push(m.embeds[0])
                feedbackPost.responses.forEach(r => {
                    let responseEmbed = new MessageEmbed({
                        "description":r.content,
                        "author":{
                            "name":r.author_tag
                        },
                        "footer":{
                            "text":`Response ID: ${r.id}`
                        }
                    });
                    newEmbeds.push(responseEmbed)
                });
                m.edit({embeds:newEmbeds});
                writeFileSync("./feedback.json", JSON.stringify(feedbackList));
                interaction.followUp({content:`Added your response to Feedback ${feedbackID}.`});
            });
        });
    };
});

client.login(config.token);

process.on("unhandledRejection", (err) => {
    console.error(err)
});