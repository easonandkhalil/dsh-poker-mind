/* 德州心法 · AI 对手库
 * 24 个固定人设：技术、性格、下注习惯、马脚与可被剥削的弱点。
 * 每局随机抽取，风格不会临时改变；但同桌对手会学习你的倾向并调整。
 */
(function (root) {
  'use strict';
  const PM = root.PM = root.PM || {};

  function P(o) {
    o.stats = Object.assign({
      vpip: 24, pfr: 18, threeBet: 6, cbet: 60, foldCbet: 48, af: 2.2,
      wtsd: 28, wonSD: 52, bluff: 20, callDown: 45, trap: 25, adapt: 55,
      tilt: 15, patience: 65, showdown: 55
    }, o.stats || {});
    return o;
  }

  const OPPONENTS = [
    P({
      id: 'linmo', name: '林墨', en: 'Lin Mo', title: '冷面教授', avatar: 'images/ai/linmo.jpg',
      style: 'TAG', styleCN: '紧凶', skill: 5, country: '中国 · 上海', quote: '情绪是最昂贵的听牌。',
      bio: '前算法工程师，把牌桌当成概率实验室。下注尺度像尺子量过，极少失控。',
      stats: { vpip: 23, pfr: 19, threeBet: 8, cbet: 66, foldCbet: 44, af: 2.9, wtsd: 28, wonSD: 56, bluff: 23, callDown: 44, trap: 34, adapt: 86, tilt: 6, patience: 90, showdown: 62 },
      strategy: { aggression: 1.0, sizing: 'balanced', openWidth: 1.0, bluffTone: 'blocker', preferred: ['价值下注', '平衡过牌', '阻断牌诈唬'], note: '范围两极分化，河牌敢超池' },
      tells: ['下注前会盯着公共牌看很久，通常是在构造范围。', '他快速过牌时，往往真的没有强牌。'],
      exploit: ['别在他面前用中等牌力支付大注。', '他过牌后可以适当偷池，但不要过度。'],
      difficulty: 5
    }),
    P({
      id: 'tangkk', name: '唐可可', en: 'Coco Tang', title: '糖衣炮弹', avatar: 'images/ai/tangkeke.jpg',
      style: 'LAG', styleCN: '松凶', skill: 4, country: '中国 · 成都', quote: '让每一手牌都看起来像坚果。',
      bio: '外表甜美，牌风泼辣。喜欢在有利位置用任何两张牌施压，河牌尤其敢开第二枪。',
      stats: { vpip: 38, pfr: 30, threeBet: 12, cbet: 75, foldCbet: 38, af: 3.6, wtsd: 26, wonSD: 52, bluff: 38, callDown: 48, trap: 22, adapt: 72, tilt: 18, patience: 55, showdown: 48 },
      strategy: { aggression: 1.38, sizing: 'polar', openWidth: 1.3, bluffTone: 'pressure', preferred: ['持续下注', '二次开火', '河牌超池'], note: '被跟注后仍可能继续施压' },
      tells: ['连续下注时语速变快，多半在诈唬。', '突然变小注，通常是薄价值。'],
      exploit: ['用强牌设陷阱，让她自己把筹码送进来。', '她的小注可以多防守，大注要收紧。'],
      difficulty: 4
    }),
    P({
      id: 'laozhou', name: '老周', en: 'Old Zhou', title: '岩石', avatar: 'images/ai/laozhou.jpg',
      style: 'NIT', styleCN: '岩石', skill: 3, country: '中国 · 北京', quote: '不输，就是赢。',
      bio: '打了十五年线下局。只玩好牌，输一个大池能念叨一晚上。',
      stats: { vpip: 12, pfr: 9, threeBet: 3, cbet: 52, foldCbet: 62, af: 1.4, wtsd: 24, wonSD: 58, bluff: 8, callDown: 28, trap: 22, adapt: 35, tilt: 12, patience: 95, showdown: 60 },
      strategy: { aggression: 0.72, sizing: 'value', openWidth: 0.7, bluffTone: 'rare', preferred: ['价值下注', '过牌跟注'], note: '大注几乎都是真货' },
      tells: ['他一加注，你就该认真考虑弃牌。', '他叹气后跟注，通常是听牌。'],
      exploit: ['可以频繁偷他的盲注。', '他一旦开火，毫不犹豫地弃掉边缘牌。'],
      difficulty: 2
    }),
    P({
      id: 'ahao', name: '阿豪', en: 'Hao', title: '疯狗', avatar: 'images/ai/ahao.jpg',
      style: 'MANIAC', styleCN: '疯子', skill: 2, country: '中国 · 重庆', quote: '要么翻倍，要么回家。',
      bio: '把每一手牌都当最后一手来打。喜欢全下，喜欢看别人难受。',
      stats: { vpip: 58, pfr: 46, threeBet: 20, cbet: 84, foldCbet: 24, af: 5.2, wtsd: 32, wonSD: 48, bluff: 48, callDown: 68, trap: 10, adapt: 30, tilt: 55, patience: 20, showdown: 40 },
      strategy: { aggression: 2.0, sizing: 'overbet', openWidth: 2.0, bluffTone: 'chaos', preferred: ['全下施压', '超池下注', '翻前暴力加注'], note: '尺度极端，容易过度诈唬' },
      tells: ['越兴奋，越可能只有一对。', '他真的拿到大牌时反而会安静。'],
      exploit: ['用强牌跟他全下，不需要想太多。', '把边缘牌扔掉，别陪他赌波动。'],
      difficulty: 2
    }),
    P({
      id: 'sophie', name: '苏菲', en: 'Sophie', title: '读心师', avatar: 'images/ai/sophie.jpg',
      style: 'ADAPTIVE', styleCN: '适应型', skill: 5, country: '法国 · 巴黎', quote: '你不是在跟牌打，你是在跟我打。',
      bio: '前职业桥牌选手，擅长从下注节奏里读人。会针对你的漏洞改变线路。',
      stats: { vpip: 27, pfr: 21, threeBet: 9, cbet: 68, foldCbet: 42, af: 2.6, wtsd: 30, wonSD: 57, bluff: 29, callDown: 52, trap: 41, adapt: 95, tilt: 5, patience: 82, showdown: 66 },
      strategy: { aggression: 1.12, sizing: 'exploitative', openWidth: 1.05, bluffTone: 'read', preferred: ['针对性诈唬', '薄价值', '延迟加注'], note: '会记住你前几手的行动' },
      tells: ['她看你的时间比看牌长时，你要小心。', '她轻轻敲桌后加注，往往是陷阱。'],
      exploit: ['保持平衡，别让她找到固定模式。', '不要用同一套下注节奏重复三次以上。'],
      difficulty: 5
    }),
    P({
      id: 'dashan', name: '大山', en: 'Dashan', title: '跟注站', avatar: 'images/ai/dashan.jpg',
      style: 'STATION', styleCN: '跟注站', skill: 2, country: '中国 · 东北', quote: '再贵也想看一眼。',
      bio: '不爱弃牌，总觉得你是在诈唬。牌桌气氛担当，也是价值下注的提款机。',
      stats: { vpip: 46, pfr: 8, threeBet: 2, cbet: 35, foldCbet: 18, af: 0.8, wtsd: 45, wonSD: 44, bluff: 5, callDown: 82, trap: 12, adapt: 18, tilt: 25, patience: 45, showdown: 45 },
      strategy: { aggression: 0.5, sizing: 'small', openWidth: 0.85, bluffTone: 'none', preferred: ['跟注到底', '小额价值'], note: '极少弃牌' },
      tells: ['他犹豫后跟注，说明他真的想跟。', '他主动加注时，牌力通常不错。'],
      exploit: ['用中等强度牌连续价值下注。', '不要尝试诈唬他。'],
      difficulty: 1
    }),
    P({
      id: 'chenmo', name: '陈默', en: 'Chen Mo', title: '猎人', avatar: 'images/ai/chenmo.jpg',
      style: 'TAG', styleCN: '紧凶', skill: 4, country: '中国 · 深圳', quote: '耐心等一个错误。',
      bio: '沉默寡言，牌风扎实。喜欢用强牌设陷阱，等你先动。',
      stats: { vpip: 21, pfr: 17, threeBet: 7, cbet: 61, foldCbet: 48, af: 2.4, wtsd: 27, wonSD: 58, bluff: 17, callDown: 46, trap: 55, adapt: 58, tilt: 8, patience: 92, showdown: 64 },
      strategy: { aggression: 0.95, sizing: 'value', openWidth: 0.95, bluffTone: 'trap', preferred: ['慢打', '过牌加注', '河牌价值'], note: '强牌常过牌设伏' },
      tells: ['他过牌后突然加注，通常是坚果。', '他连续过牌，可能真的弱。'],
      exploit: ['他过牌时不要盲目开火，他可能在设陷阱。', '面对他的过牌加注，边缘强牌要谨慎。'],
      difficulty: 4
    }),
    P({
      id: 'nina', name: '妮娜', en: 'Nina', title: '冰刃', avatar: 'images/ai/nina.jpg',
      style: 'LAG', styleCN: '松凶', skill: 5, country: '德国 · 柏林', quote: '压力不会杀死你，犹豫会。',
      bio: '线上高额桌常客。范围宽、尺度狠，尤其擅长河牌的超池极化。',
      stats: { vpip: 32, pfr: 26, threeBet: 11, cbet: 72, foldCbet: 40, af: 3.2, wtsd: 29, wonSD: 55, bluff: 33, callDown: 50, trap: 28, adapt: 80, tilt: 9, patience: 70, showdown: 57 },
      strategy: { aggression: 1.3, sizing: 'polar', openWidth: 1.2, bluffTone: 'pressure', preferred: ['超池诈唬', '持续下注', '河牌极化'], note: '河牌尺度和牌力高度相关' },
      tells: ['她盯着筹码堆思考时，往往在做极化决定。', '她过牌很果断，通常是放弃。'],
      exploit: ['在河牌用抓诈牌过牌，别主动送价值。', '她的小注范围偏弱，可以加注施压。'],
      difficulty: 5
    }),
    P({
      id: 'panghu', name: '胖虎', en: 'Panghu', title: '气氛组', avatar: 'images/ai/panghu.jpg',
      style: 'STATION', styleCN: '松被动', skill: 1, country: '中国 · 武汉', quote: '打牌嘛，开心最重要。',
      bio: '把牌桌当茶馆。喜欢看翻牌，喜欢聊天，容易被强价值下注收割。',
      stats: { vpip: 52, pfr: 6, threeBet: 1, cbet: 30, foldCbet: 15, af: 0.6, wtsd: 50, wonSD: 40, bluff: 4, callDown: 88, trap: 8, adapt: 10, tilt: 30, patience: 35, showdown: 40 },
      strategy: { aggression: 0.4, sizing: 'small', openWidth: 0.75, bluffTone: 'none', preferred: ['跟注', '最小加注'], note: '很少主动施压' },
      tells: ['他一拿到好牌就会笑。', '他叹气时基本可以确定没牌。'],
      exploit: ['连续薄价值下注，他会一直跟。', '他加注时立刻收手。'],
      difficulty: 1
    }),
    P({
      id: 'laok', name: '老K', en: 'Old K', title: '赌徒', avatar: 'images/ai/laok.jpg',
      style: 'GAMBLER', styleCN: '赌徒', skill: 2, country: '中国 · 澳门', quote: '再来一手，一定翻本。',
      bio: '相信运气和感觉。输钱后容易上头，下注尺度越来越大。',
      stats: { vpip: 44, pfr: 26, threeBet: 12, cbet: 70, foldCbet: 29, af: 3.4, wtsd: 34, wonSD: 45, bluff: 35, callDown: 65, trap: 12, adapt: 20, tilt: 68, patience: 25, showdown: 43 },
      strategy: { aggression: 1.5, sizing: 'volatile', openWidth: 1.5, bluffTone: 'gamble', preferred: ['追顺', '全下', '翻倍或回家'], note: '输池后更激进' },
      tells: ['他输了一个大池之后，下一手会明显变宽。', '他嘴里念叨“最后一手”时，通常还会继续。'],
      exploit: ['在他上头时用强牌设陷阱。', '不要在他冷静时陪他赌大波动。'],
      difficulty: 2
    }),
    P({
      id: 'guyan', name: '顾言', en: 'Gu Yan', title: '平衡者', avatar: 'images/ai/guyan.jpg',
      style: 'MATH', styleCN: '数学型', skill: 5, country: '中国 · 杭州', quote: '数字不会说谎。',
      bio: '量化交易员出身。下注频率和尺度都靠近理论最优，情绪波动极小。',
      stats: { vpip: 25, pfr: 20, threeBet: 8, cbet: 65, foldCbet: 44, af: 2.7, wtsd: 29, wonSD: 55, bluff: 26, callDown: 49, trap: 30, adapt: 65, tilt: 3, patience: 88, showdown: 60 },
      strategy: { aggression: 1.05, sizing: 'geometric', openWidth: 1.0, bluffTone: 'theory', preferred: ['几何尺度', '平衡范围', 'MDF防守'], note: '很少偏离理论' },
      tells: ['他的尺度几乎总是和筹码深度匹配。', '他很少连续过牌示弱。'],
      exploit: ['用不寻常的线路打破他的平衡。', '他大注范围两极化，抓诈要选对牌。'],
      difficulty: 5
    }),
    P({
      id: 'mia', name: '米娅', en: 'Mia', title: '诈唬艺术家', avatar: 'images/ai/mia.jpg',
      style: 'TRICKY', styleCN: '狡诈型', skill: 4, country: '西班牙 · 巴塞罗那', quote: '故事讲得好，牌不重要。',
      bio: '把每一手牌讲成一个故事。喜欢用阻断牌和牌面纹理制造压力。',
      stats: { vpip: 35, pfr: 27, threeBet: 13, cbet: 78, foldCbet: 36, af: 3.5, wtsd: 25, wonSD: 50, bluff: 44, callDown: 44, trap: 26, adapt: 70, tilt: 16, patience: 52, showdown: 49 },
      strategy: { aggression: 1.45, sizing: 'story', openWidth: 1.35, bluffTone: 'story', preferred: ['阻断牌诈唬', '多重开火', '转牌加注'], note: '故事线完整时很难读' },
      tells: ['她讲得太投入时，往往在诈唬。', '她突然安静，可能真的拿到了牌。'],
      exploit: ['不要被她的故事吓倒，用赔率做决定。', '她的小注通常是试探，不是价值。'],
      difficulty: 4
    }),
    P({
      id: 'zhaotie', name: '赵铁', en: 'Tie', title: '短筹刺客', avatar: 'images/ai/zhaotie.jpg',
      style: 'SHORT', styleCN: '短筹型', skill: 3, country: '中国 · 西安', quote: '筹码少，决定要快。',
      bio: '偏爱短筹码打法，翻前全下和反偷盲是家常便饭。',
      stats: { vpip: 28, pfr: 24, threeBet: 16, cbet: 68, foldCbet: 39, af: 3.0, wtsd: 25, wonSD: 51, bluff: 30, callDown: 40, trap: 18, adapt: 48, tilt: 22, patience: 50, showdown: 50 },
      strategy: { aggression: 1.3, sizing: 'jam', openWidth: 1.1, bluffTone: 'jam', preferred: ['翻前全下', '反偷盲', '短筹压迫'], note: '筹码越短越激进' },
      tells: ['他看一眼筹码再全下，通常是在算弃牌率。', '他平跟时反而更强。'],
      exploit: ['收紧跟注范围，别被他用弃牌率剥削。', '他平跟范围里强牌多，翻后要小心。'],
      difficulty: 3
    }),
    P({
      id: 'hejing', name: '何静', en: 'Jing', title: '耐心猎手', avatar: 'images/ai/hejing.jpg',
      style: 'NIT', styleCN: '岩石', skill: 3, country: '中国 · 苏州', quote: '不出手，就等最好的机会。',
      bio: '可以一小时不玩牌。一旦进池，往往就是价值牌。',
      stats: { vpip: 15, pfr: 11, threeBet: 4, cbet: 55, foldCbet: 58, af: 1.7, wtsd: 22, wonSD: 61, bluff: 10, callDown: 32, trap: 48, adapt: 40, tilt: 6, patience: 96, showdown: 65 },
      strategy: { aggression: 0.8, sizing: 'value', openWidth: 0.75, bluffTone: 'rare', preferred: ['慢打大牌', '价值下注'], note: '大牌愿意慢打' },
      tells: ['她补妆时，基本已经决定弃牌。', '她主动下注，牌力通常很强。'],
      exploit: ['多偷她的盲注。', '她加注就弃掉边缘牌。'],
      difficulty: 3
    }),
    P({
      id: 'ajie', name: '阿杰', en: 'Jay', title: '松凶新星', avatar: 'images/ai/ajie.jpg',
      style: 'LAG', styleCN: '松凶', skill: 3, country: '中国 · 广州', quote: '年轻就要敢打。',
      bio: '看了很多教学视频，喜欢模仿高手的激进线路，但有时过头。',
      stats: { vpip: 36, pfr: 28, threeBet: 12, cbet: 74, foldCbet: 35, af: 3.3, wtsd: 31, wonSD: 49, bluff: 36, callDown: 55, trap: 15, adapt: 48, tilt: 34, patience: 40, showdown: 47 },
      strategy: { aggression: 1.4, sizing: 'polar', openWidth: 1.3, bluffTone: 'pressure', preferred: ['持续下注', '二次开火'], note: '被加注后容易失控' },
      tells: ['他下注前搓手，多半在诈唬。', '他被加注后会明显犹豫。'],
      exploit: ['用加注考验他的边缘牌。', '他连续开火时，强牌可以跟到底。'],
      difficulty: 3
    }),
    P({
      id: 'yelin', name: '叶琳', en: 'Lynn Ye', title: '位置女王', avatar: 'images/ai/yelin.jpg',
      style: 'POSITION', styleCN: '位置型', skill: 4, country: '中国 · 厦门', quote: '位置就是筹码。',
      bio: '极度重视位置。按钮位像换了一个人，盲注位则异常克制。',
      stats: { vpip: 26, pfr: 21, threeBet: 10, cbet: 72, foldCbet: 41, af: 2.7, wtsd: 28, wonSD: 54, bluff: 28, callDown: 47, trap: 30, adapt: 70, tilt: 10, patience: 78, showdown: 58 },
      strategy: { aggression: 1.15, sizing: 'positional', openWidth: 1.1, bluffTone: 'position', preferred: ['按钮偷盲', '位置持续下注', '翻后施压'], note: '位置越好范围越宽' },
      tells: ['她在按钮位下注非常果断。', '她在盲注位跟注后过牌，通常范围偏弱。'],
      exploit: ['在盲注位对她收紧。', '她在前面位置加注时，尊重她的范围。'],
      difficulty: 4
    }),
    P({
      id: 'laozhao', name: '老赵', en: 'Zhao', title: '老江湖', avatar: 'images/ai/laozhao.jpg',
      style: 'EXPLOIT', styleCN: '剥削型', skill: 4, country: '中国 · 天津', quote: '牌是死的，人是活的。',
      bio: '线下局老油条。喜欢观察对手的习惯，用小动作和语言施压。',
      stats: { vpip: 29, pfr: 20, threeBet: 8, cbet: 64, foldCbet: 45, af: 2.3, wtsd: 31, wonSD: 55, bluff: 25, callDown: 52, trap: 38, adapt: 82, tilt: 14, patience: 72, showdown: 58 },
      strategy: { aggression: 1.05, sizing: 'exploitative', openWidth: 1.15, bluffTone: 'read', preferred: ['针对性下注', '语言施压', '陷阱'], note: '会根据你的习惯调整' },
      tells: ['他突然开始聊天，往往是在试探你。', '他沉默着跟注，可能在埋伏。'],
      exploit: ['不要被他的语言带节奏。', '保持下注尺度一致，别泄露牌力。'],
      difficulty: 4
    }),
    P({
      id: 'jinya', name: '金牙', en: 'Gold Tooth', title: '诈唬王', avatar: 'images/ai/jinya.jpg',
      style: 'MANIAC', styleCN: '过度诈唬', skill: 2, country: '中国 · 香港', quote: '不诈唬，打什么牌？',
      bio: '以诈唬为乐，喜欢在河牌用大注讲故事，但频率明显过高。',
      stats: { vpip: 48, pfr: 35, threeBet: 17, cbet: 82, foldCbet: 25, af: 4.2, wtsd: 27, wonSD: 43, bluff: 52, callDown: 58, trap: 8, adapt: 24, tilt: 40, patience: 28, showdown: 42 },
      strategy: { aggression: 1.8, sizing: 'polar', openWidth: 1.55, bluffTone: 'heavy', preferred: ['河牌诈唬', '超池下注', '连续开火'], note: '诈唬频率远超平衡' },
      tells: ['他下注越大，越可能是在诈唬。', '他拿着强牌时反而会小声。'],
      exploit: ['用抓诈牌跟注，别被他吓跑。', '他过牌时通常真的放弃。'],
      difficulty: 2
    }),
    P({
      id: 'asen', name: '阿森', en: 'Sen', title: '数学派', avatar: 'images/ai/asen.jpg',
      style: 'MATH', styleCN: '数学型', skill: 4, country: '中国 · 南京', quote: '只要赔率够，我就跟。',
      bio: '把每一手牌都换算成组合数和赔率。不太会读马脚，但很少犯数学错误。',
      stats: { vpip: 24, pfr: 18, threeBet: 7, cbet: 62, foldCbet: 46, af: 2.5, wtsd: 30, wonSD: 53, bluff: 22, callDown: 54, trap: 25, adapt: 55, tilt: 8, patience: 80, showdown: 57 },
      strategy: { aggression: 1.0, sizing: 'geometric', openWidth: 1.0, bluffTone: 'theory', preferred: ['赔率跟注', '几何尺度', '组合数'], note: '严格按赔率行动' },
      tells: ['他盯着底池计算时，通常是在算赔率。', '他弃牌很果断，不会情绪化。'],
      exploit: ['别用不合理的大注诈唬他。', '他对赔率敏感，可以用小注拿薄价值。'],
      difficulty: 4
    }),
    P({
      id: 'xiaoyu', name: '小雨', en: 'Rain', title: '情绪流', avatar: 'images/ai/xiaoyu.jpg',
      style: 'GAMBLER', styleCN: '情绪型', skill: 2, country: '中国 · 长沙', quote: '我感觉这手能赢。',
      bio: '靠感觉打牌，喜怒都写在脸上。赢了会松，输了会追。',
      stats: { vpip: 40, pfr: 22, threeBet: 9, cbet: 66, foldCbet: 32, af: 2.8, wtsd: 36, wonSD: 45, bluff: 30, callDown: 67, trap: 10, adapt: 25, tilt: 72, patience: 30, showdown: 42 },
      strategy: { aggression: 1.25, sizing: 'volatile', openWidth: 1.4, bluffTone: 'emotion', preferred: ['追听牌', '情绪跟注', '报复性加注'], note: '情绪波动极大' },
      tells: ['她用手捂嘴时，通常拿到了强牌。', '她开始抱怨运气，说明已经上头。'],
      exploit: ['在她上头时用强牌收割。', '她突然安静，多半是强牌。'],
      difficulty: 2
    }),
    P({
      id: 'along', name: '阿龙', en: 'Dragon', title: '铁头', avatar: 'images/ai/along.jpg',
      style: 'STATION', styleCN: '跟注站', skill: 2, country: '中国 · 长沙', quote: '我就不信你有。',
      bio: '坚信对手在诈唬，喜欢用任何对子跟到底。',
      stats: { vpip: 49, pfr: 12, threeBet: 3, cbet: 40, foldCbet: 22, af: 1.0, wtsd: 46, wonSD: 46, bluff: 8, callDown: 85, trap: 15, adapt: 16, tilt: 35, patience: 38, showdown: 46 },
      strategy: { aggression: 0.6, sizing: 'small', openWidth: 0.9, bluffTone: 'none', preferred: ['抓诈', '跟注到底'], note: '很难被诈唬走' },
      tells: ['他越说“我不信”，越可能真的会跟。', '他加注时牌力很强。'],
      exploit: ['价值下注，别诈唬。', '他主动加注就弃牌。'],
      difficulty: 2
    }),
    P({
      id: 'bailu', name: '白露', en: 'Bai Lu', title: '冰美人', avatar: 'images/ai/bailu.jpg',
      style: 'TRICKY', styleCN: '狡诈型', skill: 4, country: '中国 · 哈尔滨', quote: '你看得越久，越容易看错。',
      bio: '表情极少，喜欢慢打和过牌加注。看起来被动，其实暗藏杀机。',
      stats: { vpip: 24, pfr: 17, threeBet: 6, cbet: 55, foldCbet: 47, af: 2.0, wtsd: 26, wonSD: 59, bluff: 20, callDown: 43, trap: 65, adapt: 62, tilt: 8, patience: 88, showdown: 66 },
      strategy: { aggression: 0.9, sizing: 'trap', openWidth: 0.9, bluffTone: 'trap', preferred: ['慢打坚果', '过牌加注', '河牌陷阱'], note: '强牌经常过牌' },
      tells: ['她注视牌面很久后过牌，通常有强牌。', '她快速跟注，可能是中等牌力。'],
      exploit: ['不要在她过牌后盲目下注。', '她主动加注时，尊重。'],
      difficulty: 4
    }),
    P({
      id: 'daxiong', name: '大熊', en: 'Bear', title: '深筹巨兽', avatar: 'images/ai/daxiong.jpg',
      style: 'DEEP', styleCN: '深筹压迫', skill: 4, country: '俄罗斯 · 莫斯科', quote: '筹码就是武器。',
      bio: '喜欢带深筹码入桌，用筹码量制造压力。翻后尤其擅长超池施压。',
      stats: { vpip: 30, pfr: 23, threeBet: 9, cbet: 70, foldCbet: 40, af: 2.9, wtsd: 26, wonSD: 53, bluff: 31, callDown: 44, trap: 28, adapt: 60, tilt: 12, patience: 68, showdown: 55 },
      strategy: { aggression: 1.3, sizing: 'overbet', openWidth: 1.15, bluffTone: 'pressure', preferred: ['超池施压', '深筹全下', '翻后压迫'], note: '筹码越深越激进' },
      tells: ['他开始整理筹码时，往往准备下大注。', '他过牌时可能是在控制底池。'],
      exploit: ['不要用中等牌力跟他的超池。', '他深筹时，用强牌设陷阱。'],
      difficulty: 4
    }),
    P({
      id: 'aken', name: '阿KEN', en: 'Ken', title: '疯狂科学家', avatar: 'images/ai/aken.jpg',
      style: 'TRICKY', styleCN: '创意型', skill: 5, country: '美国 · 拉斯维加斯', quote: '最优解，往往藏在没人走的那条路。',
      bio: '喜欢非常规线路：过牌加注、延迟下注、河牌超池。难以预测，但逻辑自洽。',
      stats: { vpip: 31, pfr: 25, threeBet: 12, cbet: 71, foldCbet: 39, af: 3.1, wtsd: 27, wonSD: 56, bluff: 35, callDown: 48, trap: 42, adapt: 88, tilt: 7, patience: 75, showdown: 60 },
      strategy: { aggression: 1.35, sizing: 'creative', openWidth: 1.2, bluffTone: 'creative', preferred: ['延迟下注', '过牌加注', '河牌超池', '阻断牌诈唬'], note: '线路非常规，难以建模' },
      tells: ['他思考时间越长，越可能在构造诈唬。', '他快速过牌时，偶尔是在设陷阱。'],
      exploit: ['用强牌跟住他的非常规线路。', '不要试图用固定模式剥削他。'],
      difficulty: 5
    })
  ];

  const BY_ID = {};
  OPPONENTS.forEach(o => { BY_ID[o.id] = o; });

  const STYLE_INFO = {
    TAG: { cn: '紧凶', color: '#e8b765', desc: '牌少而精，进池就施压' },
    LAG: { cn: '松凶', color: '#ff7a59', desc: '范围宽，持续施压' },
    NIT: { cn: '岩石', color: '#7d9bb3', desc: '只玩强牌，耐心极高' },
    MANIAC: { cn: '疯子', color: '#ff4d6d', desc: '高频加注，波动极大' },
    STATION: { cn: '跟注站', color: '#7ec8a0', desc: '不爱弃牌，价值下注的提款机' },
    ADAPTIVE: { cn: '适应型', color: '#b58cff', desc: '会针对你的漏洞调整' },
    MATH: { cn: '数学型', color: '#63c5da', desc: '严格按赔率与组合数行动' },
    TRICKY: { cn: '狡诈型', color: '#d98cff', desc: '慢打、诈唬、非常规线路' },
    GAMBLER: { cn: '情绪型', color: '#ff9f43', desc: '波动大，容易上头' },
    POSITION: { cn: '位置型', color: '#82d173', desc: '位置越好，范围越宽' },
    EXPLOIT: { cn: '剥削型', color: '#e2c275', desc: '观察习惯，针对性调整' },
    SHORT: { cn: '短筹型', color: '#f38ba8', desc: '短筹码全下与反偷盲' },
    DEEP: { cn: '深筹型', color: '#89b4fa', desc: '用筹码深度制造压力' }
  };

  PM.Opponents = { OPPONENTS, BY_ID, STYLE_INFO };
})(typeof window !== 'undefined' ? window : globalThis);


