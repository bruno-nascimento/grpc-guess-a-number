const PROTO_PATH = __dirname + '/game.proto';

const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const moment = require('moment');

const packageDefinition = protoLoader.loadSync( PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const game = grpc.loadPackageDefinition(packageDefinition).game;

const players = [];
const ranking = {};
let currentGame = {round : 1, endsAt : moment.utc().format(), players : [], guesses : []};

const newGuessTarget = () => Math.floor(Math.random() * (20 - 1 + 1) + 1);

let guessTarget = newGuessTarget();

let timer;

const join = channel => {
    var playerJoin = channel.request;
    console.log('JOIN PLAYER : ', JSON.stringify(playerJoin));
    //console.log('Current game : ', JSON.stringify(currentGame));
    console.log('guessTarget : ', guessTarget);
    players.push({player : playerJoin, channel});
    currentGame.players.push(playerJoin);
    channel.write(currentGame);
}

timer = setInterval(() => {
    console.log('-- Encerrando o jogo');
    const winners = [];
    if (currentGame.guesses.length == 0) {
        console.log('-- Nenhum palpite')
        return;
    } else {
        console.log('-- Calculando distancia entre o numero magico e os palpites')
        for (const guess of currentGame.guesses) {
            guess.targetDistance = Math.abs(guess.guess - guessTarget);
            console.log('player : ', guess.player.name, ' distance from target : ', guess.targetDistance);
        }
        currentGame.guesses.sort((a, b) => a.targetDistance - b.targetDistance);
        const targetDistanceWinners = currentGame.guesses[0].targetDistance;
        for (const guess of currentGame.guesses) {
            if (guess.targetDistance == targetDistanceWinners) {
                winners.push(guess.player);
                updateRanking(guess.player, guess.targetDistance, true);
                continue;
            }
            updateRanking(guess.player, guess.targetDistance, false);
        }
        sortRanking();
    }
    console.log('-- Calculando o ranking')
    
    // message GameResult {
    //  int32 targetNumber = 1;
    //  repeated Player winners = 2;
    //  GameMsg game = 3;
    //  repeated Ranking ranking = 5;
    // }

    const gameResults = [];

    for (const guess of currentGame.guesses) {
        guess.channel.write({targetNumber: guessTarget, winners : winners, game : currentGame, ranking : Object.values(ranking)});
    }

    console.log('-- Iniciando uma proxima partida ...');
    ++currentGame.round;
    currentGame.guesses = [];
    currentGame.endsAt = moment.utc().format();
    guessTarget = newGuessTarget();
    console.log('-- Novo target : ', guessTarget);
    players.forEach(player => player.channel.write(currentGame));
    console.log('-- Proxima partida enviada aos jogadores.');
}, 20000);

const tryGuess = channel => {
    var guess = channel.request;
    console.log("TryGUESS >> ", guess.player.name, " => ", guess.guess);
    addGuess(guess, channel);
}

const addGuess = (guess, channel) => {
    guess.channel = channel;
    currentGame.guesses.push(guess);
}

const updateRanking = (player, targetDistance, winner) => {
    if (!ranking[player.name]) {
        ranking[player.name] = {place : 0, points : 0, player, matchesPlayed : 0, bullsEye : 0};
    }
    if (winner) {
        ranking[player.name].points += targetDistance == 0 ? 3 : 1;
        ranking[player.name].bullsEye += targetDistance == 0 ? 1 : 0;
    }
    ranking[player.name].matchesPlayed += 1;
}

const sortRanking = () => {
    let sorted = Object.values(ranking).sort((a, b) => b.points - a.points);
    sorted.forEach((rank, index) => rank.place = index+1);
}

function getServer() {
    var server = new grpc.Server();
    server.addService(game.Game.service, { join, tryGuess });
    return server;
}

if (require.main === module) {
    // If this is run as a script, start a server on an unused port
    var routeServer = getServer();
    routeServer.bind('0.0.0.0:50051', grpc.ServerCredentials.createInsecure());
    console.log('Starting server ... ');
    routeServer.start();
}

exports.getServer = getServer;