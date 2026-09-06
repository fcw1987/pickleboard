// One declarative catalog shared by the board and spatial replay.

const feet=(left,right)=>[left,right];
const contact=(kind,heightFeet,strokeSide,feetPositions=[],momentumEntersNonVolleyZone=false)=>({
    kind,heightFeet,strokeSide,feet:feetPositions,momentumEntersNonVolleyZone
});

const COMMON_PLAY_STEPS={
    setup:{id:'setup',label:'Starting Positions',description:'Green prepares to serve while Orange sets a returner deep and a partner at the kitchen.',durationMs:0,positions:{player1:{x:15,y:-1},player2:{x:5,y:-1},player3:{x:5,y:42},player4:{x:15,y:30},ball:{x:16.2,y:0}}},
    serve:{id:'serve',label:'Diagonal Serve',description:'Serve deep into the opposite service box. The serve must bounce before the return.',durationMs:900,positions:{player1:{x:15,y:1},player2:{x:5,y:-1},player3:{x:5,y:40},player4:{x:15,y:30},ball:{x:5,y:38}},shot:{from:{x:16.2,y:0},to:{x:5,y:38},type:'serve',playerId:'player1',stroke:'serve',contact:contact('serve',2.8,'forehand',feet({x:14.8,y:-.8},{x:15.6,y:-.8})),flight:{bounces:1}}},
    return:{id:'return',label:'Deep Return and Advance',description:'Return deep, then move toward the kitchen. Green stays back and lets the return bounce.',durationMs:1000,positions:{player1:{x:15,y:4},player2:{x:5,y:2},player3:{x:5,y:31},player4:{x:15,y:30},ball:{x:15,y:6}},shot:{from:{x:5.8,y:39},to:{x:15,y:6},type:'return',playerId:'player3',stroke:'forehand',contact:contact('groundstroke',2.3,'forehand',feet({x:4.7,y:40},{x:5.5,y:40})),flight:{bounces:1}}},
    thirdDrop:{id:'third-drop',label:'Third Shot Drop',description:'After the return bounces, a soft third shot lands in the Orange kitchen.',durationMs:950,positions:{player1:{x:14,y:9},player2:{x:5,y:9},player3:{x:5,y:30},player4:{x:15,y:30},ball:{x:7,y:27}},shot:{from:{x:14.4,y:7},to:{x:7,y:27},type:'drop',playerId:'player1',stroke:'drop',contact:contact('groundstroke',2.2,'forehand',feet({x:13.7,y:6.4},{x:14.7,y:6.2})),flight:{bounces:1,speedMph:18,apexFeet:7.5,netClearanceInches:16,spin:{type:'backspin',rpm:550},bounceHeightFeet:1.25}}},
    dropTransition:{id:'drop-transition',label:'Move Through Transition',description:'Green advances together behind the soft drop while Orange protects the kitchen line.',durationMs:850,positions:{player1:{x:14,y:13},player2:{x:5,y:12.5},player3:{x:5,y:30},player4:{x:15,y:30},ball:{x:7,y:27}}},
    thirdDrive:{id:'third-drive',label:'Third Shot Drive',description:'Green drives low at the established kitchen team, advancing only into transition.',durationMs:900,positions:{player1:{x:14.5,y:8.5},player2:{x:5,y:8},player3:{x:5,y:30},player4:{x:15,y:30},ball:{x:14.4,y:29.5}},shot:{from:{x:14.5,y:7},to:{x:14.4,y:29.5},type:'drive',playerId:'player1',stroke:'drive',contact:contact('groundstroke',2.4,'forehand',feet({x:13.8,y:6.4},{x:14.8,y:6.3})),flight:{bounces:0,apexFeet:5.5}}},
    block:{id:'fourth-block',label:'Compact Fourth-Shot Block',description:'Orange volleys the drive with a compact block. Green remains balanced for the next ball.',durationMs:850,positions:{player1:{x:13.5,y:10},player2:{x:5,y:9.5},player3:{x:5,y:30},player4:{x:15,y:30},ball:{x:13.5,y:12}},shot:{from:{x:14.4,y:29.5},to:{x:13.5,y:12},type:'block',playerId:'player4',stroke:'block',contact:contact('volley',2.7,'backhand',feet({x:14.3,y:29.4},{x:15.2,y:29.5})),flight:{bounces:1,apexFeet:5}}},
    fifthDrop:{id:'fifth-drop',label:'Fifth Shot Drop',description:'After the block bounces, Green drops the fifth softly into the Orange kitchen.',durationMs:950,positions:{player1:{x:14,y:12.5},player2:{x:5,y:12},player3:{x:5,y:30},player4:{x:15,y:30},ball:{x:14,y:27}},shot:{from:{x:13.8,y:12},to:{x:14,y:27},type:'drop',playerId:'player1',stroke:'drop',contact:contact('groundstroke',2.1,'forehand',feet({x:13.1,y:11.5},{x:14,y:11.3})),flight:{bounces:1}}},
    fifthTransition:{id:'fifth-transition',label:'Close in Together',description:'Green follows the fifth-shot drop forward together, ready to earn the kitchen line.',durationMs:800,positions:{player1:{x:14,y:14},player2:{x:5,y:13.5},player3:{x:5,y:30},player4:{x:15,y:30},ball:{x:14,y:27}}}
};

const opening={openingBouncesSatisfied:false};
const midrally={openingBouncesSatisfied:true};

const DINK_STEPS=[
    {id:'dink-setup',label:'Both Teams at the Line',description:'Both teams are established just outside the kitchen.',durationMs:0,positions:{player1:{x:6,y:14},player2:{x:14,y:14},player3:{x:8,y:30},player4:{x:15,y:30},ball:{x:6.2,y:14.2}}},
    {id:'forehand-dink',label:'Soft Forehand Dink',description:'Green lifts a compact forehand dink into the opposite kitchen.',durationMs:700,positions:{player1:{x:6,y:14},player2:{x:14,y:14},player3:{x:8,y:29.5},player4:{x:15,y:30},ball:{x:8,y:27}},shot:{from:{x:6.2,y:14.2},to:{x:8,y:27},type:'dink',stroke:'dink',playerId:'player1',contact:contact('groundstroke',1.7,'forehand',feet({x:5.7,y:14.3},{x:6.5,y:14.4})),flight:{bounces:1}}},
    {id:'backhand-dink',label:'Backhand Dink Reply',description:'Orange waits for the bounce and answers with a compact backhand.',durationMs:700,positions:{player1:{x:6,y:14},player2:{x:14,y:14},player3:{x:8,y:29.5},player4:{x:15,y:30},ball:{x:13,y:17}},shot:{from:{x:8.3,y:27.7},to:{x:13,y:17},type:'dink',stroke:'dink',playerId:'player3',contact:contact('groundstroke',1.55,'backhand',feet({x:7.6,y:29.3},{x:8.5,y:29.3})),flight:{bounces:1}}}
];
const VOLLEY_STEPS=[
    {id:'volley-setup',label:'Paddles Up',description:'Both teams protect the kitchen line.',durationMs:0,positions:{player1:{x:6,y:14},player2:{x:14,y:14},player3:{x:6,y:30},player4:{x:14,y:30},ball:{x:6.2,y:14.4}}},
    {id:'forehand-volley',label:'Forehand Volley',description:'Green meets the ball in the air with a short punch.',durationMs:600,positions:{player1:{x:6,y:14},player2:{x:14,y:14},player3:{x:6,y:30},player4:{x:14,y:30},ball:{x:6.1,y:29.5}},shot:{from:{x:6.2,y:14.4},to:{x:6.1,y:29.5},type:'volley',stroke:'volley',playerId:'player1',contact:contact('volley',3.1,'forehand',feet({x:5.7,y:14.2},{x:6.5,y:14.3})),flight:{bounces:0}}},
    {id:'backhand-block',label:'Backhand Block',description:'Orange absorbs the volley with a compact backhand block.',durationMs:600,positions:{player1:{x:6,y:14},player2:{x:14,y:14},player3:{x:6,y:30},player4:{x:14,y:30},ball:{x:8,y:17}},shot:{from:{x:6.1,y:29.5},to:{x:8,y:17},type:'block',stroke:'volley',playerId:'player3',contact:contact('volley',3,'backhand',feet({x:5.6,y:29.6},{x:6.5,y:29.5})),flight:{bounces:1}}}
];
const RESET_STEPS=[
    {id:'reset-setup',label:'Transition Pressure',description:'Green is in transition while Orange sends a low ball at their feet.',durationMs:0,positions:{player1:{x:7,y:11.5},player2:{x:14,y:12},player3:{x:7,y:30},player4:{x:14,y:30},ball:{x:7,y:30}}},
    {id:'pressure-feed',label:'Ball at the Feet',description:'Orange drives low so the ball lands just in front of Green.',durationMs:650,positions:{player1:{x:7,y:12},player2:{x:14,y:12},player3:{x:7,y:30},player4:{x:14,y:30},ball:{x:7.2,y:12.8}},shot:{from:{x:7,y:30},to:{x:7.2,y:12.8},type:'drive',stroke:'volley',playerId:'player3',contact:contact('volley',2.8,'forehand',feet({x:6.6,y:29.5},{x:7.4,y:29.5})),flight:{bounces:1}}},
    {id:'short-hop',label:'Short-Hop Lift',description:'Green catches the ball just after its bounce with a low compact stroke.',durationMs:550,positions:{player1:{x:7,y:12},player2:{x:14,y:12},player3:{x:7,y:30},player4:{x:14,y:30},ball:{x:14,y:29.5}},shot:{from:{x:7.35,y:13.05},to:{x:14,y:29.5},type:'short-hop',stroke:'short-hop',playerId:'player1',contact:contact('short-hop',.8,'forehand',feet({x:6.8,y:12.3},{x:7.5,y:12.2})),flight:{bounces:0}}},
    {id:'reset',label:'Backhand Reset',description:'Orange takes the ball in the air and softens it into the kitchen.',durationMs:600,positions:{player1:{x:7,y:12},player2:{x:14,y:12},player3:{x:7,y:30},player4:{x:14,y:30},ball:{x:7,y:17}},shot:{from:{x:14,y:29.5},to:{x:7,y:17},type:'reset',stroke:'reset',playerId:'player4',contact:contact('volley',2.5,'backhand',feet({x:13.6,y:29.4},{x:14.4,y:29.4})),flight:{bounces:1}}}
];
const LOB_STEPS=[
    {id:'lob-setup',label:'Draw Them Forward',description:'Green is ready to lift over an Orange player leaning toward the kitchen.',durationMs:0,positions:{player1:{x:7,y:14},player2:{x:14,y:14},player3:{x:7,y:30},player4:{x:14,y:31},ball:{x:7,y:14}}},
    {id:'lob',label:'Forehand Lob',description:'Green sends a high forehand lob over the kitchen player.',durationMs:950,positions:{player1:{x:7,y:14},player2:{x:14,y:14},player3:{x:7,y:34},player4:{x:14,y:31},ball:{x:7,y:34}},shot:{from:{x:7,y:14},to:{x:7,y:34},type:'lob',stroke:'lob',playerId:'player1',contact:contact('groundstroke',2.3,'forehand',feet({x:6.6,y:13.8},{x:7.4,y:13.8})),flight:{bounces:0,apexFeet:13}}},
    {id:'overhead',label:'Overhead Reply',description:'Orange turns, gets behind the ball, and strikes an overhead before it bounces.',durationMs:750,positions:{player1:{x:7,y:14},player2:{x:14,y:14},player3:{x:7,y:34},player4:{x:14,y:31},ball:{x:15,y:5}},shot:{from:{x:7,y:34},to:{x:15,y:5},type:'overhead',stroke:'overhead',playerId:'player3',contact:contact('volley',7.2,'forehand',feet({x:6.5,y:33.2},{x:7.4,y:33.2})),flight:{bounces:1,apexFeet:8.5}}}
];

const midRallySteps=steps=>steps.map((step,index)=>index===0?{...step,description:`Serve and return have already bounced. ${step.description}`} : step);

export const PICKLEBOARD_PLAYS=Object.freeze([
    {id:'serve-and-return',name:'Serve & Return',description:'See the legal opening pattern and the returner’s move to the kitchen.',mode:'doubles',rally:opening,steps:[COMMON_PLAY_STEPS.setup,COMMON_PLAY_STEPS.serve,COMMON_PLAY_STEPS.return]},
    {id:'third-shot-drop',name:'Third Shot Drop',description:'Use a soft third shot to begin a controlled transition forward.',mode:'doubles',rally:opening,steps:[COMMON_PLAY_STEPS.setup,COMMON_PLAY_STEPS.serve,COMMON_PLAY_STEPS.return,COMMON_PLAY_STEPS.thirdDrop,COMMON_PLAY_STEPS.dropTransition]},
    {id:'third-shot-drive',name:'Third Shot Drive',description:'Pressure the kitchen team with a low drive and prepare for another ball.',mode:'doubles',rally:opening,steps:[COMMON_PLAY_STEPS.setup,COMMON_PLAY_STEPS.serve,COMMON_PLAY_STEPS.return,COMMON_PLAY_STEPS.thirdDrive,COMMON_PLAY_STEPS.block]},
    {id:'fifth-shot-drop',name:'Fifth Shot Drop',description:'Drive the third, expect a block, then use the fifth to transition.',mode:'doubles',rally:opening,steps:[COMMON_PLAY_STEPS.setup,COMMON_PLAY_STEPS.serve,COMMON_PLAY_STEPS.return,COMMON_PLAY_STEPS.thirdDrive,COMMON_PLAY_STEPS.block,COMMON_PLAY_STEPS.fifthDrop,COMMON_PLAY_STEPS.fifthTransition]},
    {id:'dink-exchange',name:'Dink Exchange',description:'Compare compact forehand and backhand dinks after the opening bounces.',mode:'doubles',rally:midrally,steps:midRallySteps(DINK_STEPS)},
    {id:'volley-block',name:'Volley & Block',description:'Meet an airborne ball with a compact volley and controlled backhand block.',mode:'doubles',rally:midrally,steps:midRallySteps(VOLLEY_STEPS)},
    {id:'short-hop-reset',name:'Short-Hop Reset',description:'Catch a low bounce early, then take pace off the next ball.',mode:'doubles',rally:midrally,steps:midRallySteps(RESET_STEPS)},
    {id:'lob-overhead',name:'Lob & Overhead',description:'Lift a defensive lob, then see the overhead reply before a bounce.',mode:'doubles',rally:midrally,steps:midRallySteps(LOB_STEPS)}
]);

export { COMMON_PLAY_STEPS };
