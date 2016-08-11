![Logo](knx.png)
ioBroker: alternative eib(knx) Adapter
==============

Connecting the eib(knx) bus to iobroker. 
extra features:
    The Name of the Groupaddresses are used in iobroker,
    Datasubtypes are supportet. (Providing units, min, max etc.)
    Datatransformation with full configurable formulars.


### 0.0.0 (2016-11-08)
Pre Release
Known Bugs and Issues:
Configuration page is not yet implementet. EIBD server and port is hardcoded in eibd.js.
DPT might not allways be correct for DPT which are not covered by the eibd library.


## Install & Configuration

1st.)   Install eibd and configure it. Test if all runs correctly.<br>
2nd.)   Fire up your ETS and export your groupaddresses to xml. (Only 3-leve structure is tested right now.)<br>
3rd.)   Write down the complete DPT for each groupaddress. Write down wheter the ga is r,w,rw. You will find those          informations within ets.<br>
4rd.)   Open the exportet xml file and append the information received from step 3 to the groupaddress.
You can append it on a single ga or on a middlegroup. If choosen a middlegroup each ga within the middlegroup will reflect those values as long as there are no individual values set.<br>
For eaxample see the following part of my groupaddress export.<br>
As you can see, I extended the middlegroup "messen" with the field dpt and the field access.<br>
In this case: The values are readonly and the nature of the values are: float16 unit milli ampere (ma).<br>

Example:
-----------------------------------------------------------
 <GroupRange Name="messen" RangeStart="2560" RangeEnd="2815" dpt="9.021" access="r">
      <GroupAddress Name="A1 - A (WZ - LSR 1)" Address="1/2/1" />
      <GroupAddress Name="A1 - B (WZ - LSR 2)" Address="1/2/2" />
      <GroupAddress Name="A1 - C (WZ - SD 3)" Address="1/2/3" />
      <GroupAddress Name="A1 - D (WZ - SD 4)" Address="1/2/4" />
      <GroupAddress Name="A1 - E (WZ - SD 5)" Address="1/2/5" />
      <GroupAddress Name="A1 - F (WZ - SD 6)" Address="1/2/6" />
      <GroupAddress Name="A1 - G (SZ - LSR)" Address="1/2/7" />
      <GroupAddress Name="A1 - H (SZ - NTL L)" Address="1/2/8" />
...
-----------------------------------------------------------

5th) optional
If you want to change the datatype, its nature or transforming you should take a look in the ga.json file.
Here is an example:
-----------------------------------------------------------
{
    "DPT": "1_001",
    "KNX Datentyp": "B1",
    "Iobroker  Datentyp": "boolean",
    "KNX Role": "DPT_Switch",
    "Iobroker Role": "switch",
    "min": 0,
    "max": 1,
    "unit": "",
    "transform_in": "!!val",
    "transform_out": "+val"
 }
-----------------------------------------------------------
First: "DPT": "1_001" means: DPT1.001 sorry about the "_" <-> "." swap. 
2nd: "KNX Datentyp": "B1" means: boolean datatype. just for information. 
3rd; "Iobroker Datentyp": "boolean": the datatype of the corresponding iobroker state
4rd: "Iobroker Role": "switch": the role...
5th min ...
6th max ...
7th  "transform_in": "!!val": The value will be transformed to boolean (true;false)
8th  "transform_out": "+val": The value will be transformed to (0;1)

another example of tranform_in / transform_out

-----------------------------------------------------------
"transform_in": "(100 - Math.round((val/255)*100,2))",
"transform_out": "Math.round(((100 - val) / 100) * 255)"
-----------------------------------------------------------

In this case:
knx is presenting percent values as 8bit values. e.g.: values from 1 to 255. we need to tranform them to valid percent values and back.
In this special case percent value is inverted...


Here are some screenshots:
![screenshot](screenshot1.jpg)





## Usage

## License

The MIT License (MIT)

Copyright (c) 2015 ruhigundrelaxed

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
