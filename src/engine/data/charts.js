/* 德州心法 · 翻前基准范围
 * 6-max 100BB 现金局近似基准，来自公开 GTO/教学 chart 的常用简化。
 * 这些是“基准”，AI 与教练会根据对手画像、筹码深度和行动历史做剥削修正。
 */
(function (root) {
  'use strict';
  const PM = root.PM = root.PM || {};

  const OPEN = {
    UTG: '55+, A2s+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, ATo+, KJo+',
    HJ: '44+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, 76s, 65s, ATo+, KJo+, QJo',
    CO: '22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A9o+, KTo+, QTo+, JTo',
    BTN: '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A2o+, K7o+, Q8o+, J8o+, T8o+, 98o, 87o',
    SB: '22+, A2s+, K3s+, Q6s+, J7s+, T7s+, 96s+, 85s+, 74s+, 64s+, 53s+, 43s, A4o+, K9o+, Q9o+, J9o+, T9o, 98o',
    BB: '22+, A2s+, K5s+, Q7s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, A8o+, KTo+, QTo+, JTo'
  };

  // 面对一个 open raise 时的 3bet 范围（按我方位置）
  const THREE_BET = {
    UTG: 'QQ+, AKs, AKo, A5s, A4s',
    HJ: 'TT+, AQs+, AKo, A5s-A3s, KQs',
    CO: 'TT+, AQs+, AKo, A5s-A2s, KQs, KJs',
    BTN: '99+, AJs+, AQo+, A5s-A2s, KQs, KJs, QJs',
    SB: 'TT+, AJs+, AKo, A5s-A3s, KQs',
    BB: 'TT+, AJs+, AKo, A5s-A4s, KQs'
  };

  // 面对 3bet 时的 4bet 范围
  const FOUR_BET = {
    UTG: 'QQ+, AKs, AKo, A5s',
    HJ: 'JJ+, AQs+, AKo, A5s',
    CO: 'TT+, AQs+, AKo, A5s-A4s',
    BTN: 'TT+, AJs+, AKo, A5s-A3s, KQs',
    SB: 'JJ+, AQs+, AKo, A5s-A3s',
    BB: 'QQ+, AQs+, AKo, A5s-A4s'
  };

  // 面对 open 的跟注范围（会因对手和位置动态变化）
  const CALL_VS_OPEN = {
    UTG: '22-99, AQs, AJs, KQs, KJs, QJs, JTs, T9s, 98s, 87s, AQo',
    HJ: '22-99, ATs+, KJs+, QJs, JTs, T9s, 98s, 87s, 76s, AQo, KQo',
    CO: '22-99, ATs+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, 65s, AJo+, KQo',
    BTN: '22-88, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A9o+, KTo+, QTo+, JTo',
    SB: '22-99, ATs+, KTs+, QTs+, JTs, T9s, 98s, 87s, 76s, 65s, AJo+, KQo',
    BB: '22-99, A2s+, K8s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, A8o+, KTo+, QTo+, JTo'
  };

  const POSITIONS_6 = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const POSITION_CN = { UTG: '枪口', HJ: '劫位', CO: '关煞', BTN: '按钮', SB: '小盲', BB: '大盲' };
  const POSITION_ORDER = { UTG: 0, HJ: 1, CO: 2, BTN: 3, SB: 4, BB: 5 };

  PM.Charts = {
    OPEN, THREE_BET, FOUR_BET, CALL_VS_OPEN,
    POSITIONS_6, POSITION_CN, POSITION_ORDER,
    NOTE: '用于离线教学的简化 6-max 100BB 基准，非商业 GTO 解算器输出。'
  };
})(typeof window !== 'undefined' ? window : globalThis);
