const RandomMock = artifacts.require('./RandomMock.sol');
const MicroLotto = artifacts.require('./MicroLotto.sol');
const {
  mineBlocks,
  getBalance,
  getEventFromLogs,
  assertThrowsInvalidOpcode,
  assertNumberEqual,
  assertValueEqual,
  assertValueAlmostEqual
} = require('./Helpers.js');

const MAX_NUMBER = 10;
const LOTTERY_DURATION = 10;

const TICKET_FEE_WEI = web3.toWei(0.1, 'ether');

const LOTTO_FEE_PERCENT = 0.01;
const LOTTO_FEE_PERCENT_WEI = web3.toWei(LOTTO_FEE_PERCENT, 'ether');

const EXPECTED_PRIZE = TICKET_FEE_WEI - (LOTTO_FEE_PERCENT * TICKET_FEE_WEI);


contract(`MicroLotto with max number of ${MAX_NUMBER} and fee percent ${LOTTO_FEE_PERCENT}`, accounts => {
  const OWNER = accounts[0];
  const PLAYER = accounts[1];
  const EXPECTED_NUMBER = 1;
  const UNLUCKY_NUMBER = 2;

  let lotto;
  let initialBalance;

  beforeEach(async () => {
    const random = await RandomMock.new(EXPECTED_NUMBER, {
      from: OWNER
    });

    lotto = await MicroLotto.new(
      random.address,
      LOTTO_FEE_PERCENT_WEI,
      MAX_NUMBER,
      LOTTERY_DURATION,
      { from: OWNER }
    );
  });

  context(`Given filled ticket on expected number ${EXPECTED_NUMBER}`, () => {
    let fillTicketResult;
    let event;

    beforeEach(async () => {
      fillTicketResult = await lotto.fillTicket(EXPECTED_NUMBER, {
        from: PLAYER,
        value: TICKET_FEE_WEI,
      });
      event = getEventFromLogs(fillTicketResult.logs, 'TicketFilled');
    });

    it('Should emit TicketFilled event', async () => {
      assert.ok(event);
      assert.equal(event.args.account, PLAYER);
      assertNumberEqual(event.args.selectedNumber, EXPECTED_NUMBER);
    });

    it(`Should have prize equal to ${EXPECTED_PRIZE}`, async () => {
      const prize = await lotto.prize();
      assertNumberEqual(prize, EXPECTED_PRIZE);
    });

    it(`Should set lottery deadline block`, async () => {
      const deadline = await lotto.deadlineBlock();

      assertNumberEqual(deadline, event.blockNumber + LOTTERY_DURATION);
    });

    context('Given draw invoked', async () => {
      let drawResult;

      beforeEach(async () => {
        await waitUntilClosed();
        drawResult = await lotto.draw({
          from: PLAYER
        });
      });

      it('Should emit Won event', async () => {
        const event = getEventFromLogs(drawResult.logs, 'Won');
        assert.ok(event);
        assert.equal(event.args.account, PLAYER);
        assertNumberEqual(event.args.selectedNumber, EXPECTED_NUMBER);
        assertNumberEqual(event.args.profit, EXPECTED_PRIZE);
      });

    });

  });

  context(`Given filled ticket for unlucky number ${UNLUCKY_NUMBER}`, () => {

    beforeEach(async () => {
      fillTicketResult = await lotto.fillTicket(UNLUCKY_NUMBER, {
        from: PLAYER,
        value: TICKET_FEE_WEI,
      });
    });

    context('Given draw invoked', async () => {
      let drawResult;

      beforeEach(async () => {
        await waitUntilClosed();
        drawResult = await lotto.draw({
          from: PLAYER
        });
      });

      it('Should emit Cumulation event', async () => {
        const event = getEventFromLogs(drawResult.logs, 'Cumulation');
        assert.ok(event);
        assertNumberEqual(event.args.drawnNumber, EXPECTED_NUMBER);
        assertNumberEqual(event.args.value, TICKET_FEE_WEI);
      });

    });

  });

});


async function waitUntilClosed () {
  await mineBlocks(LOTTERY_DURATION + 1);
}
