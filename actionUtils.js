export const MAX_ACTION_LEVEL = 20;

export function normalizeAction(rawAction, fallbackId = Date.now()) {
  const name = String(rawAction?.name ?? '').trim();
  const numDice = Number(rawAction?.num_dice ?? rawAction?.numDice ?? 0);
  const diceSides = Number(rawAction?.dice_sides ?? rawAction?.diceSides ?? 0);
  const modifier = Number(rawAction?.modifier ?? 0);
  const ownerName = String(rawAction?.owner_name ?? rawAction?.ownerName ?? '').trim();
  const rawOwnerType = rawAction?.owner_type ?? rawAction?.ownerType ?? '';
  const ownerType = ownerName ? rawOwnerType : '';
  const rawScaling = rawAction?.level_scaling ?? rawAction?.levelScaling ?? null;
  let levelScaling = null;

  if (rawScaling) {
    const baseLevel = Number(rawScaling.base_level ?? rawScaling.baseLevel);
    const scalingDice = Number(rawScaling.num_dice ?? rawScaling.numDice);
    const scalingSides = Number(rawScaling.dice_sides ?? rawScaling.diceSides);

    if (
      !Number.isInteger(baseLevel) ||
      baseLevel < 1 ||
      baseLevel > MAX_ACTION_LEVEL ||
      !Number.isInteger(scalingDice) ||
      scalingDice <= 0 ||
      !Number.isInteger(scalingSides) ||
      scalingSides <= 0
    ) {
      throw new Error('Invalid level scaling data.');
    }

    levelScaling = {
      base_level: baseLevel,
      num_dice: scalingDice,
      dice_sides: scalingSides,
    };
  }

  if (
    !name ||
    !Number.isInteger(numDice) ||
    !Number.isInteger(diceSides) ||
    !Number.isInteger(modifier) ||
    numDice <= 0 ||
    diceSides <= 0 ||
    (ownerName && !['character', 'enemy'].includes(ownerType))
  ) {
    throw new Error('Invalid action data.');
  }

  return {
    id: String(rawAction?.id ?? fallbackId),
    name,
    num_dice: numDice,
    dice_sides: diceSides,
    modifier,
    owner_type: ownerType || null,
    owner_name: ownerName,
    level_scaling: levelScaling,
  };
}

export function getActionDiceGroups(action, level) {
  const scaling = action.level_scaling;
  if (!scaling) return [{ num_dice: action.num_dice, dice_sides: action.dice_sides }];

  if (!Number.isInteger(level) || level < scaling.base_level || level > MAX_ACTION_LEVEL) {
    throw new Error(`Choose a level from ${scaling.base_level} to ${MAX_ACTION_LEVEL}.`);
  }

  const diceGroups = [{
    num_dice: action.num_dice,
    dice_sides: action.dice_sides,
  }];
  const addedDice = (level - scaling.base_level) * scaling.num_dice;

  if (addedDice > 0) {
    const sameSidesGroup = diceGroups.find((group) => group.dice_sides === scaling.dice_sides);
    if (sameSidesGroup) {
      sameSidesGroup.num_dice += addedDice;
    } else {
      diceGroups.push({ num_dice: addedDice, dice_sides: scaling.dice_sides });
    }
  }

  return diceGroups;
}
