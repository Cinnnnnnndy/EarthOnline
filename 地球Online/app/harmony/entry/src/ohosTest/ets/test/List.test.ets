import layoutTest from './Layout.test';
import bridgeTest from './Bridge.test';

/** ohosTest 入口：DevEco 里右键 ohosTest → Run，或 hvigorw onDeviceTest */
export default function testsuite() {
  layoutTest();
  bridgeTest();
}
