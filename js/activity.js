// Teksten bij activiteiten uit het logboek van de server. Gedeeld door de kom (lijstje en
// meldingen) en de controller (Over de kom), zodat ze overal hetzelfde zeggen.
const ACTIVITY_THEMES={normal:{name:'Normaal',emoji:'🐟'},spring:{name:'Lente',emoji:'🌸'},summer:{name:'Zomer',emoji:'☀️'},autumn:{name:'Herfst',emoji:'🍂'},winter:{name:'Winter',emoji:'❄️'},tropical:{name:'Tropisch',emoji:'🌴'},arctic:{name:'Arctisch',emoji:'🧊'},halloween:{name:'Halloween',emoji:'🎃'},christmas:{name:'Kerst',emoji:'🎄'},newyear:{name:'Nieuwjaar',emoji:'🎆'}};
const PARTY_NAMES={circle:'kring',heart:'hart',wave:'wave',conga:'polonaise',smiley:'smiley',vortex:'draaikolk',sync:'synchroon'};
// Interne gebeurtenissen: staan in het logboek van de server, maar nergens voor bezoekers
const ACTIVITY_INTERNAL=new Set(['state_validation_error','invalid_access_code']);
// In de lijstjes (kom in classic, controller) staat de rest wel; als melding die even oplicht in de
// kom zijn een nieuwe QR-code en een verbonden controller ruis
const ACTIVITY_QUIET=new Set([...ACTIVITY_INTERNAL,'access_code_generated','controller_access']);

// Emoji en tekst bij een activiteit, zonder tijd. null = niet tonen aan bezoekers.
function activityText(event){
  let emoji='';
  let text='';
  switch(event.type){
    case 'feed':
      emoji='🍤';
      text=`Gevoerd`;
      break;
    case 'fish_added':
      emoji='🐟';
      text=`${event.data.name} toegevoegd`;
      break;
    case 'fish_died':
      emoji='💀';
      text=`${event.data.name} overleden`;
      break;
    case 'glass_tapped':
      emoji='👆';
      text=`Op kom getikt`;
      break;
    case 'theme_change':{
      const th=ACTIVITY_THEMES[event.data&&event.data.to];
      emoji=th&&th.emoji?th.emoji:'🎨';
      text=`Thema: ${th&&th.name?th.name:(event.data&&event.data.to)||'anders'}`;
      break;
    }
    case 'party_started':
      emoji='💃';
      text=`Dansen${PARTY_NAMES[event.data&&event.data.kind]?' ('+PARTY_NAMES[event.data.kind]+')':''}`;
      break;
    case 'play_ball_added':
      emoji='🎾';
      text=`Speelbal gegooid`;
      break;
    case 'fishing_rod_cast':
      emoji='🎣';
      text=`Hengel uitgegooid`;
      break;
    case 'fish_caught':
      emoji='🏆';
      const caughtFishName=event.data.name||'Vis';
      text=`${caughtFishName} gevangen`;
      break;
    case 'tank_cleaned':
      emoji='💩';
      text=`Kom schoongemaakt`;
      break;
    case 'water_refreshed':
      emoji='💧';
      text=`Water ververst`;
      break;
    case 'medicine_added':
      emoji='💊';
      text=`Medicijn gegeven`;
      break;
    case 'light_toggle':
      emoji='💡';
      const lightState=event.data.state||'aan';
      text=`Licht ${lightState}`;
      break;
    case 'disco_toggle':
      emoji='🎉';
      const discoState=event.data.state||'aan';
      text=`Disco ${discoState}`;
      break;
    case 'pump_toggle':
      emoji='💨';
      const pumpState=event.data.state||'aan';
      text=`Pomp ${pumpState}`;
      break;
    case 'heating_toggle':
      emoji='🔥';
      const heatingState=event.data.state||'aan';
      text=`Verwarming ${heatingState}`;
      break;
    case 'controller_access':
      emoji='🎮';
      text=`Controller verbonden`;
      break;
    case 'access_code_generated':
      emoji='🔑';
      text=`Nieuwe QR-code`;
      break;
    case 'water_greenness_milestone':
      emoji='🌿';
      const percentage=event.data.percentage||0;
      text=`Water ${percentage}% groen`;
      break;
    case 'fish_critical_health':
      emoji='⚠️';
      const criticalFishName=event.data.name||'Vis';
      text=`${criticalFishName} kritieke gezondheid`;
      break;
    case 'fish_died_disease':
      emoji='☠️';
      const diedFishName=event.data.name||'Vis';
      const cause=event.data.cause==='temperature'?'temperatuur':'ziekte';
      text=`${diedFishName} overleden (${cause})`;
      break;
    case 'fish_recovered':
      emoji='💚';
      const recoveredFishName=event.data.name||'Vis';
      text=`${recoveredFishName} hersteld`;
      break;
    case 'fish_infected_environment':
      emoji='🦠';
      const infectedFishName=event.data.name||'Vis';
      text=`${infectedFishName} geïnfecteerd (vuil water)`;
      break;
    case 'fish_infected_contact':
      emoji='🦠';
      const contactFishName=event.data.name||'Vis';
      text=`${contactFishName} geïnfecteerd (contact)`;
      break;
    case 'fish_infected_arrival':
      emoji='🦠';
      const arrivalFishName=event.data.name||'Vis';
      text=`${arrivalFishName} is ziek`;
      break;
    case 'race_started':
      emoji='🏁';
      const raceFish1=event.data.fish1||'Vis';
      const raceFish2=event.data.fish2||'Vis';
      text=`Race: ${raceFish1} vs ${raceFish2}`;
      break;
    case 'race_finished':
      emoji='🏆';
      const raceWinner=event.data.winner||'Vis';
      const raceLoser=event.data.loser||'Vis';
      text=`${raceWinner} wint van ${raceLoser}!`;
      break;
    case 'invalid_access_code':
      // Niet tonen in activity feed
      return null;
    default:
      emoji='📝';
      text=`${event.type}`;
  }
  return{emoji,text};
}
