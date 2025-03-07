import React, {useEffect, useState} from "react";
import {
    Alert,
    Button,
    Card,
    Col,
    Form,
    Modal,
    notification,
    PageHeader,
    Popover,
    Result,
    Row,
    Select,
    Space,
    Spin,
    Switch,
    Table,
    Tag,
    Tooltip,
    Typography
} from "antd";
import {IMonacoEditor, YakEditor} from "../../utils/editors";
import {formatTimestamp} from "../../utils/timeUtil";
import {showDrawer, showModal} from "../../utils/showModal";
import {fuzzerTemplates} from "./fuzzerTemplates";
import {StringFuzzer} from "./StringFuzzer";
import {InputInteger, ManyMultiSelectForString, SwitchItem} from "../../utils/inputUtil";
import {fixEncoding} from "../../utils/convertor";
import {FuzzerResponseToHTTPFlowDetail} from "../../components/HTTPFlowDetail";

const {ipcRenderer} = window.require("electron");

const analyzeFuzzerResponse = (i: FuzzerResponse, setRequest: (r: string) => any) => {
    let m = showDrawer({
        width: "70%",
        content: <>
            <FuzzerResponseToHTTPFlowDetail
                response={i}
                onSendToFuzzer={(r) => {
                    setRequest(new Buffer(r).toString())
                    m.destroy()
                }}
            /></>
    })
}

export interface HTTPFuzzerPageProp {
    isHttps?: boolean
    request?: string
}

const {Text} = Typography;

export interface FuzzerResponse {
    Method: string
    StatusCode: number
    Host: string
    ContentType: string
    Headers: { Header: string, Value: string }[]
    ResponseRaw: Uint8Array
    RequestRaw: Uint8Array
    BodyLength: number
    UUID: string
    Timestamp: number
    DurationMs: number

    Ok: boolean
    Reason: string
}

const defaultPostTemplate = `POST / HTTP/1.1
Content-Type: application/json
Host: www.example.com

{"key": "value"}`

export const HTTPFuzzerPage: React.FC<HTTPFuzzerPageProp> = (props) => {
    // params
    const [isHttps, setIsHttps] = useState(props.isHttps || false);
    const [request, setRequest] = useState(props.request || defaultPostTemplate);
    const [concurrent, setConcurrent] = useState(20);
    const [forceFuzz, setForceFuzz] = useState(true);
    const [timeout, setTimeout] = useState(5.0);
    const [proxy, setProxy] = useState("");

    // state
    const [loading, setLoading] = useState(false);
    const [content, setContent] = useState<FuzzerResponse[]>([]);
    const [templates, setTemplates] = useState<{ name: string, template: string }[]>(fuzzerTemplates)
    const [reqEditor, setReqEditor] = useState<IMonacoEditor>();
    const [debuggingTag, setDebuggingTag] = useState(false);

    useEffect(() => {
        setIsHttps(!!props.isHttps);
        if (props.request) {
            setRequest(props.request)
            setContent([])
        }
    }, [props.isHttps, props.request])

    const submitToHTTPFuzzer = () => {
        setLoading(true)
        ipcRenderer.invoke("http-fuzzer", {
            isHttps, request, forceFuzz,
            concurrent, timeout, proxy,
        })
    }

    useEffect(() => {
        ipcRenderer.on("client-http-fuzzer-error", (e, details) => {
            notification['error']({message: `提交模糊测试请求失败 ${details}`, placement: "bottomRight"})
        })
        let buffer: FuzzerResponse[] = [];
        const updateData = () => {
            if (buffer.length <= 0) {
                return
            }
            setContent([...buffer])
        }
        ipcRenderer.on("client-http-fuzzer-data", (e, data) => {
            const response = new Buffer(data.ResponseRaw).toString(fixEncoding(data.GuessResponseEncoding))
            buffer.push({
                StatusCode: data.StatusCode,
                Ok: data.Ok,
                Reason: data.Reason,
                Method: data.Method, Host: data.Host,
                ContentType: data.ContentType,
                Headers: (data.Headers || []).map((i: any) => {
                    return {Header: i.Header, Value: i.Value}
                }),
                DurationMs: data.DurationMs,
                BodyLength: data.BodyLength,
                UUID: data.UUID,
                Timestamp: data.Timestamp,
                ResponseRaw: data.ResponseRaw,
                RequestRaw: data.RequestRaw,
            })
            // setContent([...buffer])
        })
        ipcRenderer.on("client-http-fuzzer-end", () => {
            updateData()
            buffer = []
            setLoading(false)
        })

        const updateDataId = setInterval(() => {
            updateData()
        }, 1000)

        return () => {
            clearInterval(updateDataId)
            ipcRenderer.removeAllListeners("client-http-fuzzer-error")
            ipcRenderer.removeAllListeners("client-http-fuzzer-end")
            ipcRenderer.removeAllListeners("client-http-fuzzer-data")
        }
    }, [])

    const onlyOneResponse = !loading && (content || []).length === 1

    return <>
        <PageHeader
            title={"Web Fuzzer 操作台"}
            subTitle={<Space>
                <Form.Item style={{marginBottom: 0}} label={"选择 Fuzz 模版"}>
                    <Select
                        style={{width: 200}}
                        options={(templates || []).map(i => {
                            return {label: i.name, value: i.template}
                        })}
                        onChange={r => setRequest(`${r}`)}
                        placeholder={"选择一个模版开始 Fuzz"}
                    />
                </Form.Item>
                <Button
                    disabled={debuggingTag}
                    type={"primary"}
                    onClick={() => {
                        showDrawer({
                            mask: false,
                            afterVisible: () => {
                                setDebuggingTag(true)
                            },
                            afterInvisible: () => setDebuggingTag(false),
                            content: <>
                                <StringFuzzer/>
                            </>
                        })
                    }}>
                    Payload Fuzzer / 调试 Payload
                </Button>
            </Space>}
            // extra={[
            //     <Space>
            //
            //     </Space>
            // ]}
        >

        </PageHeader>
        <Row style={{marginLeft: 16, marginRight: 16}} gutter={8}>
            <Col span={10} style={{height: "100%"}}>
                <div style={{height: "100%"}}>
                    <Spin spinning={loading} style={{minHeight: 500}}>
                        <Card
                            title={"编辑需要 Fuzz 的 HTTP Request"} size={"small"} bordered={true}
                            extra={<Space>
                                {proxy && <Form.Item label={"当前代理"} style={{marginBottom: 0, padding: 0, margin: 0}}>
                                    {(proxy || "").split(",").filter(i => !!i).length > 1 ? <Tooltip
                                        title={proxy}
                                    >
                                        <Tag>{proxy.substr(0, proxy.indexOf(","))}...</Tag>
                                    </Tooltip> : <Tag>
                                        {proxy}
                                    </Tag>}
                                </Form.Item>}
                                <Form.Item
                                    style={{marginBottom: 0, padding: 0, margin: 0}}
                                    label={"HTTPS"}
                                >
                                    <Switch
                                        checked={isHttps}
                                        onChange={setIsHttps}
                                        size={"small"}
                                    />
                                </Form.Item>
                            </Space>}
                            bodyStyle={{minHeight: 500, height: 580}}
                        >
                            <YakEditor
                                value={request} setValue={setRequest}
                                editorDidMount={setReqEditor}
                            />
                        </Card>
                    </Spin>
                </div>
            </Col>
            {reqEditor && <Col span={2}>
                <Spin style={{width: "100%"}} spinning={!reqEditor}>
                    <Space
                        style={{width: "100%", marginTop: 60}}
                        direction={"vertical"}
                    >
                        <Button
                            onClick={() => {
                                setContent([])
                                submitToHTTPFuzzer()
                            }}
                            size={"small"}
                            type={"primary"}
                        >Fuzz / 执行</Button>
                        <Button
                            style={{backgroundColor: "#08a701"}}
                            size={"small"}
                            type={"primary"}
                            onClick={() => {
                                const m = showModal({
                                    width: "70%",
                                    content: <>
                                        <StringFuzzer
                                            advanced={true}
                                            disableBasicMode={true}
                                            insertCallback={(template: string) => {
                                                if (!template) {
                                                    Modal.warn({title: "Payload 为空 / Fuzz 模版为空"})
                                                } else {
                                                    if (reqEditor && template) {
                                                        reqEditor.trigger("keyboard", "type", {text: template})
                                                    } else {
                                                        Modal.error({title: "BUG: 编辑器失效"})
                                                    }
                                                    m.destroy()
                                                }
                                            }}
                                        />
                                    </>
                                })
                            }}>插入Fuzz标签</Button>
                        <Form onSubmitCapture={e => e.preventDefault()} layout={"inline"} size={"small"}>
                            <Space direction={"vertical"}>
                                <SwitchItem label={"Fuzz"} setValue={e => {
                                    if (!e) {
                                        Modal.confirm({
                                            title: "确认关闭 Fuzz 功能吗？关闭之后，所有的 Fuzz 标签将会失效",
                                            onOk: () => {
                                                setForceFuzz(e)
                                            }
                                        })
                                        return
                                    }
                                    setForceFuzz(e)
                                }} size={"small"} value={forceFuzz}/>
                                <InputInteger
                                    label={"并发"}
                                    setValue={e => {
                                        setConcurrent(e)
                                    }} formItemStyle={{width: 40}} width={40}
                                    value={concurrent}
                                />
                                <SwitchItem label={"HTTPS"} setValue={e => {
                                    setIsHttps(e)
                                }} size={"small"} value={isHttps}/>
                                <Popover
                                    title={
                                        <>
                                            设置代理: 通常可以用于访问一些因为网络问题无法访问的网页
                                            <br/>
                                            或把请求发送到基于代理模式的扫描器
                                        </>
                                    }
                                    trigger={"click"}
                                    content={<>
                                        <ManyMultiSelectForString
                                            label={"输入代理（逗号分割）"}
                                            data={[
                                                "http://127.0.0.1:7890",
                                                "http://127.0.0.1:8080",
                                                "http://127.0.0.1:8082",
                                            ].map(i => {
                                                return {label: i, value: i}
                                            })}
                                            mode={"tags"} defaultSep={","}
                                            value={proxy}
                                            setValue={(r) => {
                                                setProxy(r.split(",").join(","))
                                            }}
                                        />
                                    </>}>
                                    <Button
                                        size={"small"}
                                    >
                                        {proxy ? "修改代理" : "设置代理"}
                                    </Button>
                                </Popover>
                            </Space>
                        </Form>
                    </Space>
                </Spin>
            </Col>}
            <Col span={12}>
                <Card
                    title={<Space>
                        <Text style={{marginBottom: 0}}>模糊测试 / HTTP 请求结果</Text>
                        <Spin size={"small"} spinning={loading}/>
                    </Space>} size={"small"} bordered={true}
                    bodyStyle={{minHeight: 500, height: 580}}
                    extra={onlyOneResponse ? [
                        <Space>
                            <Form.Item
                                style={{marginBottom: 0, padding: 0, margin: 0}}
                                label={" "} colon={false}
                            >
                                <Space>
                                    <Button size={"small"}
                                            onClick={() => {
                                                analyzeFuzzerResponse(content[0], setRequest)
                                            }}
                                            type={"primary"}
                                    >分析该 HTTP 响应</Button>
                                    <Button size={"small"}
                                            onClick={() => {
                                                setContent([])
                                            }}
                                            danger={true}
                                    >清空响应</Button>
                                </Space>
                            </Form.Item>
                            <Tag>{formatTimestamp(content[0].Timestamp)}</Tag>
                        </Space>
                    ] : [
                        <Space>
                            <Form.Item
                                style={{marginBottom: 0, padding: 0, margin: 0}}
                                label={" "} colon={false}
                            >
                                <Tag>当前请求结果数[{(content || []).length}]</Tag>
                            </Form.Item>
                            <Button size={"small"} onClick={() => {
                                setContent([])
                            }}>清除数据</Button>
                        </Space>
                    ]}
                >
                    {onlyOneResponse ? <>
                        {!content[0].Ok && <Alert
                            style={{marginBottom: 8}} type={"error"}
                            message={<>
                                请求失败：{content[0].Reason}
                            </>}>

                        </Alert>}
                        <YakEditor readOnly={true} bytes={true} valueBytes={content[0].ResponseRaw}/>
                    </> : <>{(content.reverse() || []).length > 0 ? <Table<FuzzerResponse>
                        size={"small"}
                        scroll={{y: 500, x: 600}}
                        rowKey={"uuid"}
                        bordered={true}
                        columns={[
                            {
                                title: "Method",
                                width: 78,
                                fixed: "left",
                                sorter: (a: FuzzerResponse, b: FuzzerResponse) => a.Method.localeCompare(b.Method),
                                render: (i: FuzzerResponse) => <div>{i.Method}</div>
                            },
                            {
                                title: "访问状态", width: 80,
                                fixed: "left",
                                sorter: (a: FuzzerResponse, b: FuzzerResponse) => a.StatusCode - b.StatusCode,
                                render: (i: FuzzerResponse) => {
                                    return <div>{i.Ok ?
                                        <Tag color={"geekblue"}>{i.StatusCode}</Tag> : <Tooltip title={i.Reason}>
                                            <Tag color={"red"}>
                                                失败
                                            </Tag>
                                        </Tooltip>}</div>
                                }
                            },
                            {
                                title: "Body 长度", width: 85,
                                sorter: (a: FuzzerResponse, b: FuzzerResponse) => a.BodyLength - b.BodyLength,
                                render: (i: FuzzerResponse) => {
                                    return <div>{i.Ok ? i.BodyLength : ""}</div>
                                }
                            },
                            {
                                title: "延迟(ms)", width: 80,
                                sorter: (a: FuzzerResponse, b: FuzzerResponse) => a.DurationMs - b.DurationMs,
                                render: (i: FuzzerResponse) => {
                                    if (!i.Ok) {
                                        return ""
                                    }
                                    return <div>{i.DurationMs &&
                                    <Tag>{i.DurationMs}ms</Tag>}</div>
                                }
                            },
                            {
                                title: "Content-Type / 失败原因", width: 200,
                                render: (i: FuzzerResponse) => <Text
                                    ellipsis={{tooltip: true}}
                                    style={{width: 200, color: i.Ok ? undefined : "red"}}
                                >{i.Ok ? i.ContentType : i.Reason}</Text>
                            },
                            {
                                title: "请求时间", fixed: "right", width: 165,
                                sorter: (a: FuzzerResponse, b: FuzzerResponse) => a.Timestamp - b.Timestamp,
                                render: (i: FuzzerResponse) => <Tag>{formatTimestamp(i.Timestamp)}</Tag>
                            },
                            {
                                title: "操作", fixed: "right", width: 80,
                                render: (i: FuzzerResponse) => <Button
                                    size={"small"} type={"primary"}
                                    onClick={() => {
                                        analyzeFuzzerResponse(i, setRequest)
                                    }}
                                >分析详情</Button>
                            },
                        ]}
                        dataSource={content.reverse() || []}
                        pagination={false}
                    /> : <Result
                        status={"info"}
                        title={"请在左边编辑并发送一个 HTTP 请求/模糊测试"}
                        subTitle={"本栏结果针对模糊测试的多个 HTTP 请求结果展示做了优化，可以自动识别单个/多个请求的展示"}
                    />}
                    </>}
                </Card>
            </Col>
        </Row>
    </>
};