const {Telegraf} = require('telegraf');
const {Markup} = Telegraf;
const COUNTRIES_LIST = require('./const')
const request = require("request");
const fs = require('fs');
const {telegram_token, tax_gov_ua_token} = require("./config.json");

const bot = new Telegraf(telegram_token);

let _menu = '';
let temp;

const message_menu = (i) => {
    return Telegraf.Extra
        .markup((m) =>
            m.inlineKeyboard([
                [
                    m.callbackButton('Завантажити', i),
                ]
            ])
        )
};


bot.start(ctx => ctx.reply(`
   Привет, ${ctx.from.first_name}!
`, getMainMenu()))

bot.help(ctx => ctx.reply(COUNTRIES_LIST))

/*bot.on('text', async (ctx) => {
    try {
        console.log('here');

        const userText = ctx.message.text
        console.log(`https://public-api.nazk.gov.ua/v2/documents/list?query=${userText}`);
        request(encodeURI(`https://public-api.nazk.gov.ua/v2/documents/list?query=${userText}`), function (error, response, body) {
            console.log(error);
            if (!error) {
                console.log('here2');

                const resultParse = JSON.parse(body);
                const resultStringify = JSON.stringify(body, null, 2);
            }
        });
    } catch(e) {
        ctx.reply('Такой страны не существует, для получения списка стран используй команду /help')
    }
})*/
bot.hears('Авто', ctx => {
    _menu = 'vehicle';
    ctx.reply('Введіть номер т/з');
})

bot.hears('Компанії', ctx => {
    _menu = 'company';
    ctx.replyWithHTML(
        `Пошук у <b>Реєстрі платників ПДВ</b> можливий за:\n` +
        `- Назвою платника ПДВ \n` +
        `- Кодом ЄДРПОУ \n` +
        `- Номером платника ПДВ`
    );
})

bot.on('text', (ctx) => {

    if (_menu === 'vehicle') {
        getVehicle(ctx);
    } else if (_menu === 'company') {
        getCompany(ctx);
    } else {
        ctx.reply('Нічого не вибрано!', getMainMenu()).then();
    }
}).on('callback_query', (ctx) => {
    // отвечаем телеграму что получили от него запрос
    ctx.answerCbQuery();
    //console.log('ctx.callbackQuery.data', ctx.callbackQuery.data);
    //console.log('temp[ctx.callbackQuery.data]', temp[ctx.callbackQuery.data]);
    const toFile =
        `Номер платника ПДВ: ${returnValue(temp[ctx.callbackQuery.data].kodPdv)} \n` +
        `ЄДРПОУ: ${returnValue(temp[ctx.callbackQuery.data].tin)} \n` +
        `Назва платника ПДВ: ${returnValue(temp[ctx.callbackQuery.data].name)} \n` +
        `Дата реєстрації платником ПДВ: ${returnValue(temp[ctx.callbackQuery.data].datReestr)} \n` +
        `Дата скасування реєстрації платником ПДВ: ${returnValue(temp[ctx.callbackQuery.data].datAnul)} \n` +
        `Номер платника ПДВ (символьний): ${returnValue(temp[ctx.callbackQuery.data].kodPdvs)} \n` +
        `Дата анулювання свідоцтва платника ПДВ: ${returnValue(temp[ctx.callbackQuery.data].danulSg)} \n` +
        `Причина скасування реєстрації платнком ПДВ: ${returnValue(temp[ctx.callbackQuery.data].kodAnul)} \n` +
        `Підстава скасування реєстрації платнком ПДВ: ${returnValue(temp[ctx.callbackQuery.data].kodPid)} \n`

    fs.writeFileSync('./generated/file.txt', toFile);

    ctx.replyWithDocument({source: './generated/file.txt', name: 'file'}).then()

});

function getNotes(operations) {
    const toDisplay = [];
    const notes = operations.notes.split(',');
    for (let i = 1; i < notes.length; i++) {
        toDisplay.push(notes[i] + ' ');
    }
    return toDisplay;
}

function getMainMenu() {
    return Markup.keyboard([
        ['Компанії', 'Авто']
    ]).resize().extra()
}

function getVehicle(ctx) {
    const userText = ctx.message.text
    const key = "83980b6f0b110a43c4f319712a00d856";
    request(encodeURI(`https://baza-gai.com.ua/nomer/${userText}`), {
        headers: {
            "Accept": "application/json",
            "X-Api-Key": key
        }
    }, function (error, response, body) {
        if (!error) {
            const resultParse = JSON.parse(body);

            if (resultParse.error) {
                ctx.reply('Номер не знайдений.')
            }
            //  console.log(resultParse);
            //  console.log(body);
            const resultStringify = JSON.stringify(body);

            ctx.replyWithPhoto(encodeURI(resultParse.photoUrl)).then(() => {
                for (let i = 0; i < resultParse.operations.length; i++) {
                    const reg = (i) => {
                        return resultParse.operations[i].isLast ? '(текущая)' : '';
                    }
                    ctx.replyWithHTML(
                        `<b>Регистрация ${reg(i)}:</b> ${resultParse.operations[i].registered_at}\n` +
                        `<b>Модель:</b> ${resultParse.operations[i].notes.split(',')[0] + ' ' +
                        resultParse.operations[i].vendor + ' ' + resultParse.operations[i].model + ' ' +
                        resultParse.operations[i].modelYear + ' ' + getNotes(resultParse.operations[i])}\n` +

                        `<b>Операция:</b> ${resultParse.operations[i].operation.ru + ', ' + resultParse.operations[i].department}\n` +
                        `<b>Адресс:</b> ${resultParse.operations[i].address}\n\n` +
                        `<b>VIN, Страховка:</b> <a href="https://policy-web.mtsbu.ua/">Проверка подлинности полиса внутреннего страхования</a>\n`
                    );
                }
            });
        } else {
            ctx.reply('Номер не знайдений.')
        }

    });
}

function getCompany(ctx) {
    //console.log(ctx.message.text);
    const toSend = {
        "token": tax_gov_ua_token,
    }

    if (isNumber(ctx.message.text)) {
        ctx.message.text.length !== 12 ? toSend.tinList = ctx.message.text : toSend.kodPdvList = ctx.message.text;
    } else {
        toSend.name = ctx.message.text
    }

    request.post(
        encodeURI('https://cabinet.tax.gov.ua/ws/api/public/registers/pdv_act/list'),
        {
            json: toSend
        },
        function (error, response, body) {
            if (!error && body.length !== 0 && response.statusCode === 200) {
                // console.log(body);
                let i = 0;
                temp = body;
                for (let company of body) {
                    ctx.replyWithHTML(
                        `<b>Номер платника ПДВ:</b> ${returnValue(company.kodPdv)}\n` +
                        `<b>ЄДРПОУ:</b> ${returnValue(company.tin)}\n` +
                        `<b>Назва платника ПДВ:</b> ${returnValue(company.name)}\n` +
                        `<b>Дата реєстрації платником ПДВ:</b> ${returnValue(company.datReestr)}\n` +
                        `<b>Дата скасування реєстрації платником ПДВ:</b> ${returnValue(company.datAnul)}\n` +
                        `<b>Номер платника ПДВ (символьний):</b> ${returnValue(company.kodPdvs)}\n` +
                        `<b>Дата анулювання свідоцтва платника ПДВ:</b> ${returnValue(company.danulSg)}\n` +
                        `<b>Причина скасування реєстрації платнком ПДВ:</b> ${returnValue(company.kodAnul)}\n` +
                        `<b>Підстава скасування реєстрації платнком ПДВ:</b> ${returnValue(company.kodPid)}\n`, message_menu(i)
                    ).then();
                    i++;
                }
            } else {
                ctx.reply('Нічого не знайдено!');
            }
        }
    );
}

function returnValue(v) {
    if (v === null) {
        return ' - ';
    } else {
        return v;
    }
}

function isNumber(n) {
    return !isNaN(n - 0);
}

bot.launch();
