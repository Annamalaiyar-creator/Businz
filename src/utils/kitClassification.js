/**
 * Solar MMS Kit Component Classification Utility
 * Classifies kit components into: Structures, Aluminum, Fasteners & Hardware, Accessories & Others.
 */

export function classifyKitComponent(name = '') {
  const s = String(name || '').toLowerCase();

  // 1. Fasteners & Hardware (Check first to catch bolts/nuts with material descriptors)
  if (
    s.includes('bolt') || s.includes('nut') || s.includes('washer') || 
    s.includes('screw') || s.includes('fastener') || s.includes('anchor') ||
    s.includes('allen') || s.includes('hexa') || s.includes('ss304') || s.includes('ss316') ||
    s.includes('t nut') || s.includes('t-nut') || s.includes('hardware') ||
    s.includes('stud') || s.includes('rivet')
  ) {
    return 'Fasteners & Hardware';
  }

  // 2. Aluminum Components
  if (
    s.includes('clamp') || s.includes('mid clamp') || s.includes('end clamp') ||
    s.includes('aluminum') || s.includes('aluminium') || s.includes('alu') ||
    s.includes('rail') || s.includes('splice') || s.includes('l foot') ||
    s.includes('l-foot') || s.includes('grounding lug')
  ) {
    return 'Aluminum';
  }

  // 3. Structures (Columns, Legs, Rafters, Purlins, Base Plates)
  if (
    s.includes('leg') || s.includes('rafter') || s.includes('purlin') || 
    s.includes('column') || s.includes('strut') || s.includes('brace') || s.includes('bracing') ||
    s.includes('base plate') || s.includes('hdg') || s.includes('galvalume') ||
    s.includes('gal ') || s.includes('gal-') || s.includes('channel') || s.includes('beam') ||
    s.includes('post') || s.includes('structure') || s.includes('cross arm') ||
    s.includes('c purlin') || s.includes('hat purlin') || s.includes('pipe') || s.includes('tube')
  ) {
    return 'Structures';
  }

  return 'Accessories & Others';
}
