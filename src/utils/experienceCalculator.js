/**
 * Calculates garage experience dynamically based on founding date: 19th October 1993.
 * Automatically increments (+1 year) every year on October 19th!
 */
export function getGarageExperienceYears() {
  const today = new Date();
  const foundingYear = 1993;
  const foundingMonth = 9; // October (0-indexed)
  const foundingDay = 19;

  let years = today.getFullYear() - foundingYear;

  const isBeforeAnniversary =
    today.getMonth() < foundingMonth ||
    (today.getMonth() === foundingMonth && today.getDate() < foundingDay);

  if (isBeforeAnniversary) {
    years -= 1;
  }

  return years;
}
