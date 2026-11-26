import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { catalog } from '@/catalog';
import { SPECS } from '@/catalog/specs.data';
import { VehicleFacts } from '@/components/VehicleFacts';

describe('VehicleFacts spec attribution', () => {
  const withSpecs = catalog.getVehicle(Object.keys(SPECS)[0]!)!;
  const withoutSpecs = catalog.vehicles.find((v) => !SPECS[v.id])!;

  it('shows approved specs with the source, the CC BY-SA credit, the change note, the licence and the data link', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<VehicleFacts vehicle={withSpecs} />);

    expect(screen.getByText('Options offered for this generation. VYNR cannot tell which one this car has.')).toBeTruthy();
    expect(screen.getByText(/may contain errors/)).toBeTruthy();
    expect(screen.getByText(/by Wikipedia contributors\. Figures extracted/)).toBeTruthy();
    expect(screen.getByText(/available under the same licence/)).toBeTruthy();
    expect(screen.getAllByLabelText(/^Source: /).length).toBe(SPECS[withSpecs.id]!.sources.length);

    await fireEvent.press(screen.getByLabelText('Licence: CC BY-SA 4.0'));
    expect(open).toHaveBeenCalledWith('https://creativecommons.org/licenses/by-sa/4.0/');
    await fireEvent.press(screen.getByLabelText('Get this spec data'));
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/data\/specs\.json$/));
    open.mockRestore();
  });

  it('says plainly when a generation has no specs, and shows no licence note', async () => {
    await render(<VehicleFacts vehicle={withoutSpecs} />);
    expect(screen.getByText(/have not been verified yet/)).toBeTruthy();
    expect(screen.queryByLabelText('Licence: CC BY-SA 4.0')).toBeNull();
  });
});
