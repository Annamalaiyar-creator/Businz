import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePiSalesPersonName,
  canonicalizeSalespersonCode,
  CODE_TO_SALES_NAME,
  EMAIL_TO_SALES_NAME,
  EMAIL_TO_SALES_CODE
} from '../src/components/pi/piHelpers.js';
import {
  getCleanSalesPersonName
} from '../src/components/views/bom/bomStageHelpers.js';

test('resolvePiSalesPersonName resolves email addresses to canonical human names', () => {
  // Test case 1: PI with sales.s4@vrmstructures.in as salesPerson
  const pi1 = {
    piNo: 'VRMS/PI/26-27/1123',
    salesPerson: 'sales.s4@vrmstructures.in'
  };
  assert.equal(resolvePiSalesPersonName(pi1), 'Mohith JV');

  // Test case 2: PI with sales.s4@vrmstructures.in as createdBy
  const pi2 = {
    piNo: 'VRMS/PI/26-27/1122',
    createdBy: 'sales.s4@vrmstructures.in'
  };
  assert.equal(resolvePiSalesPersonName(pi2), 'Mohith JV');

  // Test case 3: PI with salesPersonEmail
  const pi3 = {
    piNo: 'VRMS/PI/26-27/1121',
    salesPersonEmail: 'sales.s1@vrmstructures.in'
  };
  assert.equal(resolvePiSalesPersonName(pi3), 'Manojraj Selvaraj');

  // Test case 4: Other sales emails
  assert.equal(resolvePiSalesPersonName({ salesPerson: 'sales.s2@vrmstructures.in' }), 'PRASHANTH');
  assert.equal(resolvePiSalesPersonName({ salesPerson: 'sales.s3@vrmstructures.in' }), 'Shanthi');
  assert.equal(resolvePiSalesPersonName({ salesPerson: 'sanjaikumar3a@gmail.com' }), 'Sanjai kumar');
  assert.equal(resolvePiSalesPersonName({ salesPerson: 'vasanthkumarsaravanan.work@gmail.com' }), 'Vasanth Kumar S');
  assert.equal(resolvePiSalesPersonName({ salesPerson: 'dhanasekar@gmail.com' }), 'Dhana Sekar');
  assert.equal(resolvePiSalesPersonName({ salesPerson: 'projectsales@jashsun.com' }), 'Pavithra');
  assert.equal(resolvePiSalesPersonName({ salesPerson: 'mms@vrmstructures.in' }), 'KALAISELVI T');

  // Test case 5: Standard name passthrough
  assert.equal(resolvePiSalesPersonName({ salesPerson: 'Mohith JV' }), 'Mohith JV');
  assert.equal(resolvePiSalesPersonName({ salesPerson: 'Manojraj Selvaraj' }), 'Manojraj Selvaraj');

  // Test case 6: Code fallback
  assert.equal(resolvePiSalesPersonName({ salesPerson: 'Sales Executive', salesPersonCode: 'SE-004' }), 'Mohith JV');
});

test('canonicalizeSalespersonCode maps emails and old codes to canonical codes', () => {
  assert.equal(canonicalizeSalespersonCode('', 'sales.s4@vrmstructures.in'), 'SE-004');
  assert.equal(canonicalizeSalespersonCode('', 'sales.s1@vrmstructures.in'), 'SE-001');
  assert.equal(canonicalizeSalespersonCode('', 'sales.s2@vrmstructures.in'), 'SE-007');
  assert.equal(canonicalizeSalespersonCode('', 'sales.s3@vrmstructures.in'), 'SE-005');
  assert.equal(canonicalizeSalespersonCode('SE-015', ''), 'SE-004');
  assert.equal(canonicalizeSalespersonCode('SH-001', ''), 'SE-001');
});

test('getCleanSalesPersonName in BOM resolves email addresses to human names', () => {
  assert.equal(getCleanSalesPersonName('sales.s4@vrmstructures.in'), 'Mohith JV');
  assert.equal(getCleanSalesPersonName('sales.s1@vrmstructures.in'), 'Manojraj Selvaraj');
  assert.equal(getCleanSalesPersonName('sales.s2@vrmstructures.in'), 'PRASHANTH');
  assert.equal(getCleanSalesPersonName('sales.s3@vrmstructures.in'), 'Shanthi');
  assert.equal(getCleanSalesPersonName('Sales Executive', 'SE-004'), 'Mohith JV');
});
