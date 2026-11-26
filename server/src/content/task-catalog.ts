/**
 * First task catalog (owner review 27.11): seeds `tasks/{taskId}` in P2.
 *
 * Rules: every task is about the player's own surroundings; no strangers,
 * documents, close-ups of children's faces or risky places.
 */

export const themes = ['office', 'students', 'friends', 'family', 'winter', 'weekend', 'outside', 'creative'] as const;
export const audiences = ['office', 'students', 'friends', 'family'] as const;
export const difficulties = ['easy', 'medium', 'hard'] as const;
/** `home` — doable without going out; `outside` — needs a walk; `any` — either. */
export const places = ['home', 'outside', 'any'] as const;

export type Theme = (typeof themes)[number];
export type Audience = (typeof audiences)[number];
export type Difficulty = (typeof difficulties)[number];
export type Place = (typeof places)[number];

export interface TaskCatalogEntry {
  id: string;
  title: { uk: string; en: string };
  description: { uk: string; en: string };
  themes: Theme[];
  audiences: Audience[];
  difficulty: Difficulty;
  place: Place;
}

const all: Audience[] = ['office', 'students', 'friends', 'family'];

function task(
  id: string,
  uk: [string, string],
  en: [string, string],
  themeList: Theme[],
  audienceList: Audience[],
  difficulty: Difficulty,
  place: Place,
): TaskCatalogEntry {
  return {
    id,
    title: { uk: uk[0], en: en[0] },
    description: { uk: uk[1], en: en[1] },
    themes: themeList,
    audiences: audienceList,
    difficulty,
    place,
  };
}

export const catalog: TaskCatalogEntry[] = [
  // Office and colleagues
  task('desk-view', ['Мій робочий вид', 'Сфотографуй те, що бачиш, коли відриваєш очі від роботи.'], ['View from my desk', 'Photograph what you see when you look up from work.'], ['office'], ['office', 'students'], 'easy', 'any'),
  task('mug-story', ['Чашка з історією', 'Твоя улюблена чашка й одне речення в підписі: чому саме вона.'], ['A mug with a story', 'Your favourite mug and one line in the caption on why it is the one.'], ['office', 'creative'], ['office', 'students', 'friends'], 'easy', 'any'),
  task('lunch-plate', ['Обід дня', 'Твій сьогоднішній обід — гарно, смішно чи чесно.'], ['Lunch of the day', "Today's lunch: pretty, funny or honest."], ['office'], ['office', 'students', 'friends'], 'easy', 'any'),
  task('team-hands', ['Руки команди', 'Руки всіх, хто поруч, в одному кадрі: у колі, на столі чи над чашками.'], ['Team hands', 'The hands of everyone around you in one shot: in a circle, on a table or over mugs.'], ['office', 'friends'], ['office', 'students', 'friends', 'family'], 'medium', 'any'),
  task('green-colleague', ['Зелений колега', 'Рослина, яка «працює» поруч із тобою — на роботі чи вдома.'], ['Green colleague', 'A plant that "works" next to you, at the office or at home.'], ['office'], ['office', 'students', 'family'], 'easy', 'any'),
  task('sticky-note-art', ['Мистецтво стікерів', 'Склади картинку або слово зі стікерів чи клаптиків паперу.'], ['Sticky note art', 'Make a picture or a word out of sticky notes or scraps of paper.'], ['office', 'creative'], ['office', 'students', 'family'], 'medium', 'any'),
  task('commute', ['Дорога на роботу', 'Найгарніший момент твоєї дороги сьогодні.'], ['The commute', 'The most beautiful moment of your way today.'], ['office', 'outside'], ['office', 'students'], 'easy', 'outside'),
  task('meeting-doodle', ['Каракулі на полях', 'Малюнок, що з’явився на полях блокнота під час наради чи пари.'], ['Margin doodle', 'A drawing that appeared in the margins during a meeting or a lecture.'], ['office', 'creative'], ['office', 'students'], 'easy', 'any'),
  task('team-shadows', ['Тіні команди', 'Тіні кількох людей в одному кадрі — без облич, лише силуети.'], ['Team shadows', 'Shadows of several people in one shot: no faces, only silhouettes.'], ['office', 'friends', 'creative'], ['office', 'friends', 'students'], 'medium', 'any'),
  task('snack-stash', ['Запаси в шухляді', 'Покажи свій стратегічний запас смаколиків.'], ['Snack stash', 'Show your strategic snack reserve.'], ['office'], ['office', 'students'], 'easy', 'any'),
  task('museum-piece', ['Музейний експонат', 'Найстаріша техніка, яка досі працює у тебе вдома чи в офісі.'], ['Museum piece', 'The oldest gadget that still works at your home or office.'], ['office', 'family'], ['office', 'family', 'friends'], 'medium', 'any'),
  task('tidy-desk', ['До і після', 'Робоче місце до і після п’яти хвилин прибирання — два кадри в одному.'], ['Before and after', 'Your desk before and after five minutes of tidying: two shots in one.'], ['office'], ['office', 'students', 'family'], 'easy', 'any'),
  task('coffee-art', ['Кавовий настрій', 'Чашка кави чи чаю, знята творчо: піна, ложка, світло з вікна.'], ['Coffee mood', 'A cup of coffee or tea shot creatively: foam, a spoon, window light.'], ['creative', 'office'], ['office', 'students', 'friends'], 'easy', 'any'),
  task('window-weather', ['Погода за вікном', 'Що зараз за твоїм вікном.'], ['Weather outside', 'What is outside your window right now.'], ['office', 'family'], all, 'easy', 'home'),

  // Students
  task('study-spot', ['Місце для навчання', 'Де тобі вчиться найкраще.'], ['Study spot', 'Where you study best.'], ['students'], ['students', 'office'], 'easy', 'any'),
  task('best-notes', ['Найкрасивіший конспект', 'Сторінка нотаток, якою ти пишаєшся.'], ['Best notes', 'A page of notes you are proud of.'], ['students', 'creative'], ['students', 'office'], 'easy', 'any'),
  task('campus-corner', ['Улюблений куточок', 'Місце в університеті, школі чи місті, де тобі добре.'], ['Favourite corner', 'A place at your university, school or in town where you feel good.'], ['students', 'outside'], ['students', 'friends'], 'medium', 'outside'),
  task('book-tower', ['Вежа з книжок', 'Склади вежу з книжок і зніми її, поки вона стоїть.'], ['Book tower', 'Build a tower of books and shoot it while it still stands.'], ['students', 'creative', 'family'], ['students', 'family', 'friends'], 'medium', 'home'),
  task('study-fuel', ['Паливо для навчання', 'Що допомагає тобі вчитися чи працювати допізна.'], ['Study fuel', 'What keeps you going when you study or work late.'], ['students'], ['students', 'friends', 'office'], 'easy', 'any'),
  task('pen-army', ['Армія ручок', 'Усі ручки й олівці, які знайдеш поруч, в одному кадрі.'], ['Army of pens', 'Every pen and pencil you can find nearby in one shot.'], ['students', 'office', 'creative'], ['students', 'office', 'family'], 'easy', 'any'),
  task('now-playing', ['Що в навушниках', 'Навушники та обкладинка пісні, яку слухаєш зараз.'], ['Now playing', 'Your headphones and the cover of the song you are listening to.'], ['students', 'friends'], ['students', 'friends', 'office'], 'easy', 'any'),

  // Friends
  task('jump-shot', ['Стрибок!', 'Фото в стрибку — сам чи з друзями.'], ['Jump!', 'A mid-air jump shot, alone or with friends.'], ['friends', 'outside'], ['friends', 'students', 'family'], 'medium', 'any'),
  task('reflection', ['Віддзеркалення', 'Кадр із відображенням: вітрина, ложка, дзеркало чи екран.'], ['Reflection', 'A shot with a reflection: a shop window, a spoon, a mirror or a screen.'], ['creative'], ['friends', 'students', 'office'], 'medium', 'any'),
  task('then-and-now', ['Тоді і зараз', 'Повтори своє старе фото в тій самій позі й місці.'], ['Then and now', 'Recreate an old photo of yourself in the same pose and place.'], ['friends', 'family', 'creative'], ['friends', 'family', 'students'], 'hard', 'any'),
  task('human-letter', ['Жива літера', 'Утворіть разом літеру руками чи тілами — нехай група вгадає.'], ['Human letter', 'Form a letter together with your hands or bodies and let the group guess it.'], ['friends', 'creative'], ['friends', 'students', 'family', 'office'], 'hard', 'any'),
  task('color-hunt', ['Колір дня', 'Знайди надворі щось яскраво-жовте.'], ['Colour hunt', 'Find something bright yellow outside.'], ['outside', 'creative'], all, 'easy', 'outside'),
  task('tiny-world', ['Маленький світ', 'Іграшка чи дрібниця, знята так, ніби вона велетенська.'], ['Tiny world', 'A toy or a small object shot as if it were huge.'], ['creative'], ['friends', 'family', 'students'], 'medium', 'any'),
  task('sky-today', ['Небо сьогодні', 'Світанок, захід сонця чи просто хмари над тобою.'], ['Sky today', 'Sunrise, sunset or simply the clouds above you.'], ['outside'], all, 'easy', 'outside'),
  task('house-boss', ['Головний у домі', 'Офіційний портрет домашнього улюбленця чи улюбленої іграшки.'], ['Head of the house', 'An official portrait of your pet or your favourite toy.'], ['family', 'friends'], all, 'easy', 'home'),

  // Family with children
  task('breakfast-together', ['Сніданок разом', 'Стіл під час сімейного сніданку: тарілки й руки, без облич крупним планом.'], ['Breakfast together', 'The table at a family breakfast: plates and hands, no close-up faces.'], ['family'], ['family'], 'easy', 'home'),
  task('drawing-together', ['Малюємо разом', 'Малюнок, який ви зробили всією родиною чи компанією.'], ['Drawing together', 'A drawing made by the whole family or group.'], ['family', 'creative'], ['family', 'friends'], 'easy', 'home'),
  task('blanket-fort', ['Фортеця з ковдр', 'Збудуйте фортецю з ковдр і подушок.'], ['Blanket fort', 'Build a fort out of blankets and pillows.'], ['family', 'creative', 'weekend'], ['family', 'friends', 'students'], 'medium', 'home'),
  task('shadow-puppets', ['Театр тіней', 'Тінь звірятка з рук на стіні.'], ['Shadow puppets', 'A hand-shadow animal on the wall.'], ['family', 'creative'], ['family', 'students', 'friends'], 'easy', 'home'),
  task('build-of-the-day', ['Будівля дня', 'Конструкція з кубиків, LEGO чи коробок.'], ['Build of the day', 'A construction made of blocks, LEGO or boxes.'], ['family', 'creative'], ['family', 'friends'], 'medium', 'home'),
  task('little-chefs', ['Кухарі', 'Страва, яку ви приготували разом, або сам процес — руки в кадрі.'], ['Little chefs', 'A dish you cooked together or the cooking itself, hands in the shot.'], ['family', 'weekend'], ['family', 'friends', 'students'], 'medium', 'home'),
  task('big-and-small-hands', ['Велика і маленька долоні', 'Долоні дорослого й дитини поруч.'], ['Big hand, small hand', "An adult's palm next to a child's."], ['family'], ['family'], 'easy', 'home'),
  task('favourite-toy', ['Улюблена іграшка', 'Найулюбленіша іграшка в родині та її ім’я в підписі.'], ['Favourite toy', "The family's most loved toy and its name in the caption."], ['family'], ['family'], 'easy', 'home'),
  task('game-night', ['Вечір настільних ігор', 'Партія в настільну гру чи карти.'], ['Game night', 'A round of a board game or cards.'], ['family', 'friends', 'weekend'], all, 'easy', 'home'),
  task('funny-socks', ['Найсмішніші шкарпетки', 'Найяскравіші чи найкумедніші шкарпетки в домі.'], ['Funniest socks', 'The brightest or funniest socks in the house.'], ['creative', 'family'], all, 'easy', 'home'),
  task('family-recipe', ['Сімейний рецепт', 'Страва за рецептом, який передається у вашій родині.'], ['Family recipe', 'A dish made from a recipe your family passes down.'], ['family', 'weekend'], ['family', 'friends', 'office'], 'medium', 'home'),

  // Winter and New Year
  task('snow-close-up', ['Сніг зблизька', 'Сніжинка на рукавичці чи сніг крупним планом. Снігу немає — іній чи холодне скло.'], ['Snow up close', 'A snowflake on a glove or snow up close. No snow? Frost or cold glass.'], ['winter', 'outside'], all, 'easy', 'outside'),
  task('snowman', ['Сніговик', 'Сніговик будь-якого розміру — хоч завбільшки з долоню.'], ['Snowman', 'A snowman of any size, even palm-sized.'], ['winter', 'outside', 'family'], ['family', 'friends', 'students'], 'medium', 'outside'),
  task('ornament-story', ['Іграшка з історією', 'Ялинкова прикраса й одне речення про те, звідки вона.'], ['Ornament with a story', 'A tree ornament and one line on where it came from.'], ['winter'], all, 'easy', 'home'),
  task('holiday-lights', ['Вогники', 'Святкові вогники з боке — розмитими кульками світла.'], ['Holiday lights', 'Festive lights with bokeh: soft, blurred circles of light.'], ['winter', 'creative'], all, 'medium', 'any'),
  task('cozy-corner', ['Затишок', 'Найзатишніше місце вдома: плед, чай, книга.'], ['Cozy corner', 'The coziest spot at home: a blanket, tea, a book.'], ['winter', 'weekend'], all, 'easy', 'home'),
  task('warm-drink', ['Гарячий напій', 'Какао, чай чи узвар — твій зимовий напій.'], ['Warm drink', 'Cocoa, tea or a fruit punch: your winter drink.'], ['winter'], all, 'easy', 'any'),
  task('frosty-window', ['Зимове вікно', 'Візерунок на склі, паморозь або зимовий вид із вікна.'], ['Frosty window', 'Patterns on the glass, frost or a winter view from the window.'], ['winter'], all, 'easy', 'home'),
  task('gift-wrap', ['Пакування подарунка', 'Подарунок, загорнутий власноруч.'], ['Gift wrap', 'A present you wrapped yourself.'], ['winter', 'creative'], all, 'medium', 'home'),
  task('new-year-wish', ['Бажання на рік', 'Запиши бажання на папірці й сфотографуй — текст можна сховати.'], ['A wish for the year', 'Write a wish on a slip of paper and shoot it; you may hide the text.'], ['winter', 'creative'], all, 'easy', 'any'),
  task('tangerine-art', ['Мандаринова гора', 'Що можна скласти з мандаринок чи шкірок.'], ['Tangerine art', 'What you can build out of tangerines or their peel.'], ['winter', 'creative', 'family'], all, 'medium', 'home'),
  task('winter-trail', ['Зимова стежка', 'Сліди на снігу чи доріжка, якою ти сьогодні йшов.'], ['Winter trail', 'Footprints in the snow or the path you walked today.'], ['winter', 'outside'], all, 'easy', 'outside'),
  task('holiday-sweater', ['Новорічний светр', 'Найсвятковіший або найкумедніший светр чи шапка.'], ['Holiday sweater', 'Your most festive or funniest sweater or hat.'], ['winter', 'friends', 'office'], all, 'easy', 'any'),
  task('holiday-cookies', ['Святкове печиво', 'Печиво чи пряники, які ви спекли або прикрасили.'], ['Holiday cookies', 'Cookies or gingerbread you baked or decorated.'], ['winter', 'family', 'weekend'], ['family', 'friends', 'students'], 'medium', 'home'),
  task('countdown', ['Відлік до свята', 'Скільки днів до Нового року — цифра, складена з будь-чого.'], ['Countdown', 'Days left until New Year: a number made of anything.'], ['winter', 'creative'], all, 'medium', 'any'),
  task('winter-treat', ['Зимові смаколики', 'Щось смачне, що буває лише взимку.'], ['Winter treat', 'Something tasty you only have in winter.'], ['winter', 'family'], all, 'easy', 'any'),

  // Weekend
  task('slow-breakfast', ['Неспішний сніданок', 'Твій сніданок вихідного дня.'], ['Slow breakfast', 'Your weekend breakfast.'], ['weekend'], all, 'easy', 'home'),
  task('new-place', ['Нове місце', 'Місце у твоєму місті, де ти ще ніколи не був.'], ['A new place', 'A place in your town where you have never been before.'], ['weekend', 'outside'], ['friends', 'students', 'office'], 'hard', 'outside'),
  task('weekend-hobby', ['Хобі вихідного', 'Чим ти сьогодні займався для себе.'], ['Weekend hobby', 'What you did today just for yourself.'], ['weekend'], all, 'easy', 'any'),
  task('bookshelf', ['Полиця', 'Твоя книжкова полиця або одна книга, яку радиш.'], ['Bookshelf', 'Your bookshelf or one book you recommend.'], ['weekend', 'students'], all, 'easy', 'home'),
  task('first-view', ['Перший погляд', 'Що ти бачиш першим уранці вихідного.'], ['First view', 'The first thing you see on a weekend morning.'], ['weekend'], ['students', 'friends', 'office'], 'easy', 'home'),
  task('rest-spot', ['Місце для відпочинку', 'Улюблена лавка чи затишне місце надворі.'], ['Rest spot', 'Your favourite bench or a cosy spot outdoors.'], ['weekend', 'outside'], all, 'easy', 'outside'),

  // Outside
  task('oldest-tree', ['Найстаріше дерево', 'Найбільше чи найстаріше дерево поблизу.'], ['Oldest tree', 'The biggest or oldest tree nearby.'], ['outside'], all, 'medium', 'outside'),
  task('street-art', ['Мурал', 'Мурал чи стінопис у твоєму районі.'], ['Street art', 'A mural in your neighbourhood.'], ['outside', 'creative'], ['friends', 'students', 'office'], 'medium', 'outside'),
  task('bird-spotting', ['Пташка', 'Будь-яка пташка — горобець теж рахується.'], ['Bird spotting', 'Any bird at all; a sparrow counts too.'], ['outside', 'family'], all, 'medium', 'outside'),
  task('puddle-world', ['Світ у калюжі', 'Місто чи небо, відображені в калюжі.'], ['World in a puddle', 'The town or the sky reflected in a puddle.'], ['outside', 'creative'], all, 'medium', 'outside'),
  task('interesting-door', ['Двері', 'Найцікавіші двері чи вхід, які трапились тобі сьогодні.'], ['A door', 'The most interesting door or entrance you saw today.'], ['outside'], ['office', 'friends', 'students'], 'easy', 'outside'),
  task('step-goal', ['Десять тисяч кроків', 'Знімок місця, де ти набрав найбільше кроків за день.'], ['Ten thousand steps', 'A shot of the place where you walked the most today.'], ['outside'], ['office', 'friends', 'students'], 'medium', 'outside'),

  // Creative and funny
  task('faces-in-things', ['Обличчя в речах', 'Знайди «обличчя» в предметах: розетка, сумка, будинок.'], ['Faces in things', 'Find a "face" in objects: a socket, a bag, a building.'], ['creative'], all, 'easy', 'any'),
  task('rainbow', ['Веселка', 'Предмети всіх кольорів веселки в одному кадрі.'], ['Rainbow', 'Objects in every colour of the rainbow in one shot.'], ['creative', 'family'], all, 'medium', 'home'),
  task('food-face', ['Їжа з настроєм', 'Склади смішне обличчя з їжі на тарілці.'], ['Food with a mood', 'Arrange a funny face out of food on a plate.'], ['creative', 'family'], all, 'easy', 'home'),
  task('forced-perspective', ['Велетень', 'Кадр із перспективою: тримаєш сонце, будинок чи друга на долоні.'], ['Giant', 'A forced-perspective shot: hold the sun, a building or a friend in your palm.'], ['creative', 'friends'], all, 'hard', 'any'),
  task('one-colour-look', ['Образ одного кольору', 'Вбрання чи кадр, де все одного кольору.'], ['One-colour look', 'An outfit or a scene where everything is one colour.'], ['creative', 'friends'], ['friends', 'students', 'office'], 'medium', 'any'),
  task('black-and-white', ['Монохром', 'Чорно-біле фото з цікавою тінню чи текстурою.'], ['Black and white', 'A black-and-white photo with an interesting shadow or texture.'], ['creative'], all, 'medium', 'any'),
  task('living-emoji', ['Живий смайлик', 'Повтори будь-який емодзі виразом обличчя чи предметами.'], ['Living emoji', 'Recreate any emoji with your expression or with objects.'], ['creative', 'friends', 'office'], all, 'easy', 'any'),
  task('find-me', ['Знайди мене', 'Сховай у кадрі маленьку іграшку — нехай група шукає.'], ['Find me', 'Hide a small toy in the shot and let the group find it.'], ['creative', 'family'], ['family', 'friends', 'students'], 'easy', 'any'),
  task('word-of-the-day', ['Слово дня', 'Слово, складене з предметів, магнітиків чи літер на вивісках.'], ['Word of the day', 'A word spelled with objects, fridge magnets or letters on signs.'], ['creative'], all, 'hard', 'any'),
];
