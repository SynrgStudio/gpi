#define MyAppName "GPi"
#define MyAppPublisher "Synrg Studio"
#define MyAppURL "https://github.com/SynrgStudio/gpi"
#define MyAppExeName "GPi.exe"
#define MyAppVersion GetEnv("GPI_VERSION")
#if MyAppVersion == ""
  #define MyAppVersion "0.0.13"
#endif

[Setup]
AppId={{9E6D7A4B-7699-45CB-94C8-F5F348279D7D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\release\installer
OutputBaseFilename=GPi-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
SetupIconFile=..\resources\assets\gpi-logo.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked
Name: "openwithgpi"; Description: "Add ""Open in GPi"" to folder right-click menus"; GroupDescription: "Windows Explorer integration:"; Flags: unchecked

[Files]
Source: "..\release\GPi-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Classes\Directory\shell\Open in GPi"; ValueType: string; ValueData: "Open in GPi"; Flags: uninsdeletekey; Tasks: openwithgpi
Root: HKCU; Subkey: "Software\Classes\Directory\shell\Open in GPi"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\{#MyAppExeName}"; Flags: uninsdeletekey; Tasks: openwithgpi
Root: HKCU; Subkey: "Software\Classes\Directory\shell\Open in GPi\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Flags: uninsdeletekey; Tasks: openwithgpi
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\Open in GPi"; ValueType: string; ValueData: "Open in GPi"; Flags: uninsdeletekey; Tasks: openwithgpi
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\Open in GPi"; ValueType: string; ValueName: "Icon"; ValueData: "{app}\{#MyAppExeName}"; Flags: uninsdeletekey; Tasks: openwithgpi
Root: HKCU; Subkey: "Software\Classes\Directory\Background\shell\Open in GPi\command"; ValueType: string; ValueData: """{app}\{#MyAppExeName}"" ""%V"""; Flags: uninsdeletekey; Tasks: openwithgpi

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
