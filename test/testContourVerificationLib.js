const { contract } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const contractPoint = require('@galtproject/utils').contractPoint;
const { addHeightToContour } = require('./localHelpers');

const PPContourVerificationPublicLib = contract.fromArtifact('PPContourVerificationPublicLib');

PPContourVerificationPublicLib.numberFormat = 'String';

describe('PPContourVerificationLib', () => {
  // Contour #1
  // 40.594870, -73.949618 dr5qvnpd300r
  // 40.594843, -73.949866 dr5qvnp655pq
  // 40.594791, -73.949857 dr5qvnp3g3w0
  // 40.594816, -73.949608 dr5qvnp9cnpt

  // Contour #2 (intersects 1)
  // 40.594844, -73.949631 dr5qvnpd0eqs
  // 40.594859, -73.949522 dr5qvnpd5npy
  // 40.594825, -73.949512 dr5qvnp9grz7
  // 40.594827, -73.949617 dr5qvnpd100z

  // Contour #3 (doesn't intersect 1)
  // 40.594803, -73.949607 dr5qvnp9c7b2
  // 40.594777, -73.949852 dr5qvnp3ewcv
  // 40.594727, -73.949838 dr5qvnp37vs4
  // 40.594754, -73.949594 dr5qvnp99ddh

  // Contour #4 (completely included by 1)
  // 40.594840, -73.949792 dr5qvnp6hfwt
  // 40.594838, -73.949829 dr5qvnp6h46c
  // 40.594797, -73.949845 dr5qvnp3gdwu
  // 40.594801, -73.949828 dr5qvnp3u57s

  // Contour #5 (intersects both 1 and 3)
  // 40.594806, -73.949748 dr5qvnp3vur6
  // 40.594813, -73.949713 dr5qvnp3yv97
  // 40.594784, -73.949705 dr5qvnp3ybpq
  // 40.594778, -73.949744 dr5qvnp3wp47

  // Contour #6 (collinear with 7, vertex not real)
  // dr5qvnpdb9g8
  // dr5qvnpdv9g8
  // dr5qvnpdt9g8
  // dr5qvnpd29g8

  // Contour #7 (collinear with 6, vertex not real)
  // dr5qvnpdu9g8
  // dr5qvnpdf9g8
  // dr5qvnpd39g8
  // dr5qvnpd59g8

  const rawContour1 = ['dr5qvnpd300r', 'dr5qvnp655pq', 'dr5qvnp3g3w0', 'dr5qvnp9cnpt'];
  const contour1 = rawContour1.map(contractPoint.encodeFromGeohash);
  const contour1Point = contractPoint.encodeFromLatLng(40.5948277257, -73.9497781981);
  const rawContour2 = ['dr5qvnpd0eqs', 'dr5qvnpd5npy', 'dr5qvnp9grz7', 'dr5qvnpd100z'];
  const contour2 = rawContour2.map(contractPoint.encodeFromGeohash);
  const contour1Contour2Point = contractPoint.encodeFromLatLng(40.5948365051, -73.9496169672);
  const contour2Point = contractPoint.encodeFromLatLng(40.5948365392, -73.9495732865);
  const rawContour3 = ['dr5qvnp9c7b2', 'dr5qvnp3ewcv', 'dr5qvnp37vs4', 'dr5qvnp99ddh'];
  const contour3 = rawContour3.map(contractPoint.encodeFromGeohash);
  // const contour1Contour3Point = contractPoint.encodeFromLatLng(40.5948074835, -73.9497317122);
  // const rawContour4 = ['dr5qvnp6hfwt', 'dr5qvnp6h46c', 'dr5qvnp3gdwu', 'dr5qvnp3u57s'];
  // const contour4 = rawContour4.map(contractPoint.encodeFromGeohash);
  const rawContour5 = ['dr5qvnp3vur6', 'dr5qvnp3yv97', 'dr5qvnp3ybpq', 'dr5qvnp3wp47'];
  const contour5 = rawContour5.map(contractPoint.encodeFromGeohash);
  // const contour1Contour5Point = contractPoint.encodeFromLatLng(40.5948079809, -73.9497188934);
  const rawContour6 = ['dr5qvnpda9gb', 'dr5qvnpda9gv', 'dr5qvnpda9gt', 'dr5qvnpda9g2'];
  const contour6 = rawContour6.map(contractPoint.encodeFromGeohash);
  // console.log('contour6', contour6);
  const rawContour7 = ['dr5qvnpda9gu', 'dr5qvnpda9gf', 'dr5qvnpda9g3', 'dr5qvnpda9g5'];
  const contour7 = rawContour7.map(contractPoint.encodeFromGeohash);
  // console.log('contour7', contour7);
  // const rawContour8 = ['dr5bvnpda9ga', 'dr5vvnpda9ga', 'dr5tvnpda9ga', 'dr52vnpda9ga'];
  // const contour8 = rawContour8.map(contractPoint.encodeFromGeohash);
  // const rawContour9 = ['dr5uvnpda9ga', 'dr5fvnpda9ga', 'dr53vnpda9ga', 'dr55vnpda9ga'];
  // const contour9 = rawContour9.map(contractPoint.encodeFromGeohash);
  let lib;

  before(async function() {
    lib = await PPContourVerificationPublicLib.new();
  });

  describe('collinear segment detection', () => {
    it('should match when one contour includes another on 9-th geohash precision level', async function() {
      assert.equal(
        await lib.segmentsAreCollinear(
          contractPoint.encodeFromGeohash('dr5qvnpdb9g8'),
          contractPoint.encodeFromGeohash('dr5qvnpdv9g8'),
          contractPoint.encodeFromGeohash('dr5qvnpdu9g8'),
          contractPoint.encodeFromGeohash('dr5qvnpdf9g8')
        ),
        true
      );

      assert.equal(
        await lib.pointInsideContour(
          ['dr5qvnpdb9g8', 'dr5qvnpdv9g8', 'dr5qvnpdt9g8', 'dr5qvnpd29g8'].map(contractPoint.encodeFromGeohash),
          ['dr5qvnpdu9g8', 'dr5qvnpdf9g8', 'dr5qvnpd39g8', 'dr5qvnpd59g8'].map(contractPoint.encodeFromGeohash),
          contractPoint.encodeFromLatLng(40.5949390009, -73.9495249377)
        ),
        true
      );

      const collinearContour1 = [
        '3504908379293184277775089960751380970484929',
        '3504908379293184267663027581401573803463709',
        '3504908379293184275610438330677859925195924',
        '3504908379293184272425294371702652776185295',
        '3504908379293184279042971574425585869879316',
        '3504908379293184291505241382486358460634246'
      ];
      const collinearContour2 = [
        '3504908379293184276105216900222897518066954',
        '3504908379293184272425294371702652776185295',
        '3504908379293184275610438330677859925195924',
        '3504908379293184265220051476743923045052113',
        '3504908379293184244717583796716105286622206',
        '3504908379293184247067791225427070709953585',
        '3504908379293184236739256304372281954668313',
        '3504908379293184244006351132210159812812507',
        '3504908379293184253809172293908300056543103',
        '3504908379293184256283083588377561732987908',
        '3504908379293184266518849833485665153149377',
        '3504908379293184267199165754924073416653579'
      ];

      assert.equal(
        await lib.pointInsideContour(
          collinearContour1,
          collinearContour2,
          contractPoint.encodeFromLatLng(40.7557079387, -73.9652475815)
        ),
        false
      );

      assert.equal(await lib.contourSegmentsIntersects(collinearContour1, collinearContour2, '1', '2', true), false);
      assert.equal(await lib.contourSegmentsIntersects(collinearContour1, collinearContour2, '1', '2', false), true);
    });

    it('should match when one contour includes another on 12-th geohash precision level', async function() {
      assert.equal(
        await lib.segmentsAreCollinear(
          contractPoint.encodeFromGeohash('dr5qvnpdd9gb'),
          contractPoint.encodeFromGeohash('dr5qvnpdd9gv'),
          contractPoint.encodeFromGeohash('dr5qvnpdd9gu'),
          contractPoint.encodeFromGeohash('dr5qvnpdd9gf')
        ),
        true
      );
    });

    it.skip('should NOT match contour intersection degree is extremely low on 12-th degree level', async function() {
      // TODO: find the better case
      assert.equal(
        await lib.segmentsAreCollinear(
          contractPoint.encodeFromGeohash('dr5qanpdd9gb'),
          contractPoint.encodeFromGeohash('dr5qanpdd9gz'),
          contractPoint.encodeFromGeohash('dr5qanpdd9gy'),
          contractPoint.encodeFromGeohash('dr5qanpdd9g8')
        ),
        false
      );
    });
  });

  describe('contour intersection', () => {
    it('should return true for intersecting contours', async function() {
      assert.equal(await lib.contourSegmentsIntersects(contour1, contour2, 3, 0, true), true);

      assert.equal(await lib.contourSegmentsIntersects(contour1, contour2, 3, 0, false), true);
    });

    it('should return false for non-intersecting contours', async function() {
      assert.equal(await lib.contourSegmentsIntersects(contour1, contour3, 3, 3, true), false);

      assert.equal(await lib.contourSegmentsIntersects(contour1, contour3, 3, 3, false), false);
    });

    it('should match collinear contours if specified', async function() {
      assert.equal(
        await lib.contourSegmentsIntersects(
          contour6,
          contour7,
          0,
          0,
          // excludeCollinear
          false
        ),
        true
      );
    });

    it('should exclude collinear contours if specified', async function() {
      assert.equal(
        await lib.contourSegmentsIntersects(
          contour6,
          contour7,
          0,
          0,
          // excludeCollinear
          true
        ),
        false
      );
    });
  });

  describe('contour inclusion', () => {
    it('should match when a B contour point inside contour A', async function() {
      assert.equal(await lib.pointInsideContour(contour1, contour2, contour1Contour2Point), true);
    });

    it('should not match when a B point is not inside contour A', async function() {
      assert.equal(await lib.pointInsideContour(contour1, contour2, contour2Point), false);
    });

    it('should not match when a A point is not inside contour B', async function() {
      assert.equal(await lib.pointInsideContour(contour5, contour1, contour1Point), false);
    });

    describe('precision', () => {
      // TODO: there could be some inclusion precision tests
    });
  });

  describe('height inclusion', async function() {
    it('should return the lowest z point of the contour', async function() {
      assert.equal(await lib.getLowestElevation(addHeightToContour(contour1, 20)), 20);
      assert.equal(await lib.getLowestElevation(addHeightToContour(contour1, 0)), 0);
      assert.equal(await lib.getLowestElevation(addHeightToContour(contour1, -1000)), -1000);
    });

    it('should check for intersections', async function() {
      assert.equal(await lib.checkVerticalIntersection(30, 20, -5, -10), false);
      assert.equal(await lib.checkVerticalIntersection(30, 20, 10, -5), false);
      assert.equal(await lib.checkVerticalIntersection(30, 20, 10, -5), false);
      assert.equal(await lib.checkVerticalIntersection(30, 20, 20, 15), false);
      assert.equal(await lib.checkVerticalIntersection(30, 20, 35, 30), false);
      assert.equal(await lib.checkVerticalIntersection(30, 20, 40, 35), false);

      assert.equal(await lib.checkVerticalIntersection(30, 20, 40, 10), true);
      assert.equal(await lib.checkVerticalIntersection(30, 20, 25, 22), true);

      assert.equal(await lib.checkVerticalIntersection(30, 20, 30, 20), true);
      assert.equal(await lib.checkVerticalIntersection(30, 21, 30, 20), true);
      assert.equal(await lib.checkVerticalIntersection(30, 20, 30, 21), true);
      assert.equal(await lib.checkVerticalIntersection(30, 19, 30, 20), true);
      assert.equal(await lib.checkVerticalIntersection(30, 20, 30, 19), true);
      assert.equal(await lib.checkVerticalIntersection(0, 0, 0, 0), true);
      assert.equal(await lib.checkVerticalIntersection(30, 20, 25, 25), true);

      assert.equal(await lib.checkVerticalIntersection(-20, -30, -22, -25), true);
      assert.equal(await lib.checkVerticalIntersection(-20, -30, -10, -40), true);

      // TODO: figure out what we should do with HP < LP
      assert.equal(await lib.checkVerticalIntersection(20, 30, 20, 10), false);
    });
  });
});
