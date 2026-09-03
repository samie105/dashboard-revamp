/**
 * Which trading venues are open.
 *
 * One switch, because more than one screen has to agree about it. The
 * dashboard's Total and the portfolio's net worth were computed independently
 * and only the portfolio excluded futures, so the same user was shown two
 * different net worths depending on which page they were standing on — and
 * the larger of the two counted money they could not open a screen to reach.
 *
 * Typed `boolean` on purpose so TypeScript keeps checking both arms.
 *
 * TO RE-OPEN: set this to false, then delete it along with every block that
 * reads it (search `FUTURES_CLOSED`). The dashboard's `dailyPnL` also dropped
 * its futures term when this went in; that comes back with the venue.
 */
export const FUTURES_CLOSED: boolean = true
