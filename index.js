require('dotenv').config();
const {writeFile, unlink} = require('fs');
const {Client, MessageEmbed} = require('discord.js');
const client = new Client({intents: 32767, partials: ['MESSAGE', 'CHANNEL']});
const mongoose = require('mongoose');

const randomatic = require('randomatic');
const Rooms = require('./room');

mongoose.connect('mongodb://localhost:27017/new-ashton', 
{useNewUrlParser: true, useUnifiedTopology: true})
.then(() => console.log('Connected to db !'))
.catch((err) => console.error(err));

client.on('ready',() => {
    console.log(`${client.user.username} is ready !`);
    client.user.setActivity('MP MOI - SUPPORT H24', {type: 'WATCHING'});
});

client.on('message',async (message) => {
    const prefixed = message.content.split(' ')[0];
    const content = message.content.replace(prefixed, '').trim();
    
    if(prefixed == '/close' && message.guildId == process.env.SERVER) {
        onCommandClose(message);
    } else if(prefixed == '/r' && message.guildId == process.env.SERVER) {
        onCommandResponse(message, content);
    } else if(prefixed == '/archive' && message.guildId == process.env.SERVER) {
        onCommandArchive(message);
    };
});

client.on('messageCreate',async (message) => {
    const user = await client.users.fetch(message.author, {force: true});
    const server = client.guilds.cache.get(process.env.SERVER);
    const itIsExistRoom = await Rooms.findOne({user_id: message.author.id});

    if(message.channel.type == 'DM' && !itIsExistRoom && user.id !== client.user.id) {
        onRoomCreated(message, server, user);
    } else if(message.channel.type == 'DM' && user.id !== client.user.id) {
        onRoomMessage(message, server, user, itIsExistRoom.room_id);
    };
});

async function onRoomCreated(message, server, user) {
    message.channel.send('Votre message a bien été transmis.\nNous traitons votre demande dans les plus bref délais.');
        
    const room = new Rooms({
        room_id: randomatic('a0', 6),
        user_id: message.author.id,
    });

    room.save()
    .then((res) => {
        const parent = server.channels.cache.get(process.env.PARENT);
        server.channels.create(res.room_id, {type: 'text', parent: parent})
        .then((channel) => {
            const embed = new MessageEmbed()
            .setColor(user.hexAccentColor)
            .setDescription(message.content ?? null)
            .setAuthor({
                name: user.username,
                iconURL: user.avatarURL(),
            });

            const files = message.attachments.map((file) => {
                return file.url;
            });
            
            channel.send({embeds: [embed], files: files});
        })
        .catch((err) => {
            message.channel.send(`**Oups! Quelque chose s'est mal passé!**\n${err.message}`);
        });
    })
    .catch((err) => {
        message.channel.send(`**Oups! Quelque chose s'est mal passé!**\n${err.message}`);
    });
};

async function onRoomMessage(message, server, user, room) {
    const channel = server.channels.cache.find(e => e.name == room);
        
    const embed = new MessageEmbed()
    .setColor(user.hexAccentColor)
    .setDescription(message.content ?? null)
    .setAuthor({
        name: user.username,
        iconURL: user.avatarURL(),
    });
    
    const files = message.attachments.map((file) => {
        return file.url;
    });
    
    channel.send({embeds: [embed], files: files});
};

async function onCommandClose(message) {
    const channel = await Rooms.findOne({room_id: message.channel.name});
    const user = client.users.cache.get(channel.user_id);
    
    Rooms.deleteOne({user_id: channel.user_id}).then(() => {
        user.send(`Ticket closed by **${message.author.username}**.`);
        message.channel.delete();
    });
};

async function onCommandResponse(message, content) {
    const channel = await Rooms.findOne({room_id: message.channel.name});
    const author = await client.users.fetch(message.author, {force: true});
    const user = client.users.cache.get(channel.user_id);

    const embed = new MessageEmbed()
    .setColor(author.hexAccentColor)
    .setDescription(content ?? null)
    .setAuthor({  
        name: author.username,
        iconURL: author.avatarURL(),
    });

    const files = message.attachments.map((file) => {
        return file.url;
    });

    user.send({embeds: [embed], files: files});
};

async function onCommandArchive(Message) {
    const server = client.guilds.cache.get(process.env.SERVER);
    const Room = await Rooms.findOne({user_id: Message.author.id});
    const channel = server.channels.cache.find(e => e.name == Room.room_id);

    channel.messages.fetch().then((messages) => {
        let elements = '';

        messages.reverse().forEach((message) => { 
            const date = `${message.createdAt.getHours()}:${message.createdAt.getMinutes()}, ${message.createdAt.toDateString()}`;
            const embed = message.embeds.shift() ?? undefined;

            if(!embed) {
                elements = elements + `[${date}] ${message.author.username} : ${message.content}\n`;
            } else {
                elements = elements + `[${date}] ${embed.author.name} : ${embed.description}\n`;
            };
        });

        writeFile(`${Room.room_id}.txt`, elements,(err) => {
            if(err) Message.channel.send(`**Oups! Quelque chose s'est mal passé!**\n${err.message}`);

            Message.channel.send({files: [`${Room.room_id}.txt`]}).then(() => {
                unlink(`${Room.room_id}.txt`,(err) => {
                    if(err) Message.channel.send(`**Oups! Quelque chose s'est mal passé!**\n${err.message}`);
                });
            });
        });
    });
};

client.login(process.env.TOKEN);
