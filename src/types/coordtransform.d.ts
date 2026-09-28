declare module 'coordtransform' {
  const coordtransform: {
    wgs84togcj02(longitude: number, latitude: number): [number, number]
    gcj02towgs84(longitude: number, latitude: number): [number, number]
    gcj02tobd09(longitude: number, latitude: number): [number, number]
    bd09togcj02(longitude: number, latitude: number): [number, number]
  }
  export default coordtransform
}
