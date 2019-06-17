const PROTO_PATH = __dirname + '/game.proto';

const grpc = require('grpc');
const protoLoader = require('@grpc/proto-loader');
const readline = require('readline');

const packageDefinition = protoLoader.loadSync( PROTO_PATH, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true });
const game = grpc.loadPackageDefinition(packageDefinition).game;
let client = null;

let input = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const sortRanking = (ranking) => {
    return ranking.sort((a, b) => b.points - a.points);
}

const runJoin = playerName => {
    const player = { name : playerName };
    const call = client.join({name : playerName});
    call.on('data', gameMsg => {
        currentGame = gameMsg;
        input.close();
        input = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        input.question('Take a guess : ', guess => {
            gameResult = client.tryGuess({ game: gameMsg, guess: parseInt(guess), player }); // <<<<<<<<<<<<<<<<<<
            gameResult.on('data', result => {
                result.ranking = sortRanking(result.ranking);
                console.log('');
                console.log(`Round ${gameMsg.round} results : `);
                console.log(`\tTarget number : ${result.targetNumber}`);
                const playerGuess = result.game.guesses.find(guess => guess.player.name == player.name);
                console.log(`\t\t${playerGuess.player.name}\t\t\t: ${playerGuess.guess} - Distance from target : \t${playerGuess.targetDistance}`);
                for (let guess of result.game.guesses){
                    if(guess.player.name != player.name){
                        console.log(`\t\t${guess.player.name}\t\t\t: ${guess.guess} - Distance from target : \t${guess.targetDistance}`);
                    }
                }
                console.log('');
                console.log('\t+++ RANKING +++');
                for (const rank of result.ranking) {
                    console.log(`\t\t${rank.place}\t\t - ${rank.player.name}\t\t - points : ${rank.points}\t\t - bullseye : ${rank.bullsEye}\t\t - matches played : ${rank.matchesPlayed}`);
                }
                console.log('');
                console.log('');
            });
        });
    });
    call.on('end', () => {console.log('end runJOIN')});
}

const main = () => {
    if (!process.env.GAME_SERVER) {
        console.log('You must tell where the server is. Like that >> GAME_SERVER="123.456.789.0:50051" node game_client.js << The PORT is always the same. Check your IP.')
        process.exit(-1)
    }
    client = new game.Game(process.env.GAME_SERVER, grpc.credentials.createInsecure());
    input.question("What's ur name? ", userName => {
        runJoin(userName);
    });
}

if (require.main === module) {
    main();
}
