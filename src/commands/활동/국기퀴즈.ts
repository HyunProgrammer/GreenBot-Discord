import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ComponentType } from 'discord.js';
import axios from 'axios';
import 'dotenv/config.js';
import mysql from 'mysql';
import country from '../../country.json' assert { type: 'json' };

const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: 'ubuntu',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE
});

export default {
  data: new SlashCommandBuilder()
    .setName('국기퀴즈')
    .setDescription('256개의 국기 퀴즈를 풀어보세요!'),

  async execute(interaction: ChatInputCommandInteraction) {
    const countryCodes = Object.keys(country);
    const randomIndex = () => Math.floor(Math.random() * countryCodes.length);

    let countryCode = countryCodes[randomIndex()];
    let wrongCountryCode1 = countryCodes[randomIndex()];
    let wrongCountryCode2 = countryCodes[randomIndex()];

    while (wrongCountryCode1 === countryCode || wrongCountryCode2 === countryCode || wrongCountryCode1 === wrongCountryCode2) {
      wrongCountryCode1 = countryCodes[randomIndex()];
      wrongCountryCode2 = countryCodes[randomIndex()];
    }

    // @ts-ignore
    let correctCountryName = country[countryCode];
    const correctButton = new ButtonBuilder().setCustomId('correct').setLabel(correctCountryName).setStyle(1);
    // @ts-ignore
    let wrongCountryName1 = country[wrongCountryCode1];
    const wrongButton1 = new ButtonBuilder().setCustomId('wrong1').setLabel(wrongCountryName1).setStyle(1);
    // @ts-ignore
    let wrongCountryName2 = country[wrongCountryCode2];
    const wrongButton2 = new ButtonBuilder().setCustomId('wrong2').setLabel(wrongCountryName2).setStyle(1);
    const multipleRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...[correctButton, wrongButton1, wrongButton2].sort(() => Math.random() - 0.5));

    const image = await axios.get(`https://flagcdn.com/w320/${countryCode}.png`);
    const embed = new EmbedBuilder()
      .setColor('Random')
      .setImage(image.request.res.responseUrl)
      .setTitle('아래 국기는 어디 국기일까요?')
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: `${interaction.user.displayAvatarURL()}` });
    interaction.followUp({ embeds: [embed], components: [multipleRow] });

    const collector = interaction.channel?.createMessageComponentCollector({ componentType: ComponentType.Button, time: 10000 });
    collector?.on('collect', i => {
      i.deferUpdate();

      connection.query(`SELECT * FROM activity WHERE id=${i.user.id}`, function (error, result) {
        if (result == '') {
          connection.query(`INSERT INTO activity(id, flag_quiz) VALUES (${i.user.id}, 0)`);
        }

        if (i.customId === 'correct') {
          connection.query(`UPDATE activity SET flag_quiz=${result[0].flag_quiz + 1} WHERE id=${i.user.id}`);

          const correctEmbed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle(`✅ ${i.user.tag}님 정답!`)
            .setDescription(`정답은 **'${correctCountryName}'** 이였습니다.\n현재 점수: **${result[0].flag_quiz + 1}**점`)
            .setTimestamp()
            .setFooter({ text: `Requested by ${i.user.tag}`, iconURL: i.user.displayAvatarURL() });
          interaction.followUp({ embeds: [correctEmbed] });
          collector.stop();

          if (result[0].flag_quiz + 1 >= 5) {
            interaction.client.achievements.GRANT(interaction, 'flag_quiz_1');
            if (result[0].flag_quiz + 1 >= 25) {
              interaction.client.achievements.GRANT(interaction, 'flag_quiz_2');
              if (result[0].flag_quiz + 1 >= 50) {
                interaction.client.achievements.GRANT(interaction, 'flag_quiz_3');
                if (result[0].flag_quiz + 1 >= 100) {
                  interaction.client.achievements.GRANT(interaction, 'flag_quiz_4');
                  if (result[0].flag_quiz + 1 >= 200) {
                    interaction.client.achievements.GRANT(interaction, 'flag_quiz_5');
                  }
                }
              }
            }
          }
        }
        else {
          const wrongEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle(`❌ ${i.user.tag}님 오답!`)
            .setDescription(`정답은 **'${correctCountryName}'** 이였습니다.\n현재 점수: **${result[0].flag_quiz}**점`)
            .setTimestamp()
            .setFooter({ text: `Requested by ${i.user.tag}`, iconURL: i.user.displayAvatarURL() });
          interaction.followUp({ embeds: [wrongEmbed] });
          return collector.stop();
        }
      });
    });

    collector?.on('end', collected => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor('#FFFF00')
          .setTitle(`⏰ ${interaction.user.tag}님 시간 초과!`)
          .setDescription(`정답은 **'${correctCountryName}'** 이였습니다.`)
          .setTimestamp()
          .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });
        interaction.followUp({ embeds: [timeoutEmbed] });
      }
    });
  },
};
